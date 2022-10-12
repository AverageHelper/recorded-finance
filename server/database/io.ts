import type { CollectionReference, DocumentReference } from "./references";
import type { FileData, PrismaPromise, User as DBUser } from "@prisma/client";
import type {
	AnyData,
	DataItem,
	DataItemKey,
	Identified,
	IdentifiedDataItem,
	User,
	UserKeys,
} from "./schemas";
import {
	assertSchema,
	computeRequiredAddtlAuth,
	isDataItemKey,
	isNonEmptyArray,
	sortStrings,
	user as userSchema,
} from "./schemas";
import { maxSpacePerUser } from "../auth/limits";
import { newPubNubCipherKey } from "../auth/pubnub";
import { NotFoundError, UnreachableCaseError } from "../errors";
import { ONE_HOUR } from "../constants/time";
import { PrismaClient } from "@prisma/client";

// Start connecting to the database
const dataSource = new PrismaClient();
process.stdout.write("Connected to database\n");

// Log database accesses
dataSource.$use(async (params, next) => {
	const before = Date.now();
	const result: unknown = await next(params);
	const after = Date.now();
	console.debug(`Query ${params.model ?? "undefined"}.${params.action} took ${after - before}ms`);
	return result;
});

interface UserStats {
	totalSpace: number;
	usedSpace: number;
}

export async function statsForUser(uid: string): Promise<UserStats> {
	const totalSpace = Math.ceil(maxSpacePerUser);
	const usedSpace = await totalSizeOfFilesForUser(uid);

	return { totalSpace, usedSpace };
}

export async function numberOfUsers(): Promise<number> {
	return await dataSource.user.count();
}

// MARK: - Pseudo Large-file Storage

export async function fetchFileData(userId: string, fileName: string): Promise<FileData | null> {
	return await dataSource.fileData.findUnique({
		where: { userId_fileName: { userId, fileName } },
	});
}

/**
 * Returns the total number of bytes that comprise a given file.
 */
export async function totalSizeOfFile(userId: string, fileName: string): Promise<number | null> {
	const file = await dataSource.fileData.findUnique({
		where: { userId_fileName: { userId, fileName } },
		select: { size: true },
	});
	if (file === null) throw new NotFoundError();
	return file.size;
}

/**
 * Returns the number of bytes of the user's stored files.
 */
export async function totalSizeOfFilesForUser(userId: string): Promise<number> {
	const files = await dataSource.fileData.findMany({
		where: { userId },
		select: { size: true },
	});
	return files.reduce((prev, { size }) => prev + size, 0);
}

/**
 * Stores the given file data, replacing existing data if it already exists.
 */
export function upsertFileData(
	attachment: Omit<FileData, "size">
): PrismaPromise<Pick<FileData, "size">> {
	const userId = attachment.userId;
	const fileName = attachment.fileName;
	const contents = attachment.contents;
	const size = contents.length;

	return dataSource.fileData.upsert({
		select: { size: true },
		where: {
			userId_fileName: { userId, fileName },
		},
		update: { contents, size },
		create: {
			contents,
			size,
			fileName,
			user: {
				connect: { uid: userId },
			},
		},
	});
}

/**
 * Deletes the file with the given name.
 *
 * @returns a `Promise` that resolves with the number of bytes deleted.
 */
export async function destroyFileData(userId: string, fileName: string): Promise<number> {
	const file = await dataSource.fileData.delete({
		where: { userId_fileName: { userId, fileName } },
		select: { size: true },
	});
	return file?.size ?? 0;
}

// MARK: - Database

/**
 * Resolves to `true` if the given token exists in the database.
 */
export async function jwtExistsInDatabase(token: string): Promise<boolean> {
	const result = await dataSource.expiredJwt.findUnique({
		where: { token },
		select: { token: true },
	});
	return result !== null;
}

/**
 * Stores the given token in a blacklist.
 *
 * The blacklist assumes that the JWT has an hour-long expiration
 * window. Values will be purged sometime after that expiration
 * window elapses.
 */
export async function addJwtToDatabase(token: string): Promise<void> {
	await dataSource.expiredJwt.upsert({
		where: { token },
		update: {}, // nop if the value already exists
		create: { token }, // database generates the timestamp
	});
}

/**
 * Purges the database of expired JWTs older than two hours.
 */
export async function purgeExpiredJwts(): Promise<void> {
	const twoHrsAgo = new Date(new Date().getTime() - 2 * ONE_HOUR);
	await dataSource.expiredJwt.deleteMany({
		where: {
			createdAt: { lte: twoHrsAgo },
		},
	});
}

export async function fetchDbCollection(
	ref: CollectionReference
): Promise<Array<IdentifiedDataItem>> {
	const uid = ref.uid;

	switch (ref.id) {
		case "accounts":
		case "attachments":
		case "locations":
		case "tags":
		case "transactions":
			return (
				await dataSource.dataItem.findMany({
					where: { userId: uid, collectionId: ref.id },
					select: {
						ciphertext: true,
						cryption: true,
						objectType: true,
						docId: true,
					},
				})
			).map(v => ({ ...v, _id: v.docId }));
		case "keys":
			return (
				await dataSource.userKeys.findMany({
					where: { userId: uid },
					select: {
						dekMaterial: true,
						oldDekMaterial: true,
						oldPassSalt: true,
						passSalt: true,
						userId: true,
					},
				})
			).map(k => ({
				...k,
				_id: k.userId,
				oldDekMaterial: k.oldDekMaterial ?? undefined,
				oldPassSalt: k.oldPassSalt ?? undefined,
			}));
		case "users": {
			// Special handling: fetch all users
			const rawUsers = (await dataSource.user.findMany()).map(computeRequiredAddtlAuth);
			return await Promise.all(
				rawUsers.map(async user => {
					// Upsert the cipher key if it doesn't exist
					let pubnubCipherKey = user.pubnubCipherKey;
					if (pubnubCipherKey === null) {
						pubnubCipherKey = await newPubNubCipherKey();
						await dataSource.user.update({
							where: { uid: user.uid },
							data: { pubnubCipherKey },
						});
					}
					return { ...user, pubnubCipherKey };
				})
			);
		}
		default:
			throw new UnreachableCaseError(ref.id);
	}
}

async function findUserWithProperties(query: Partial<User>): Promise<User | null> {
	if (Object.keys(query).length === 0) return null; // Fail gracefully for an empty query
	const first = await dataSource.user.findFirst({
		where: {
			...query,
			requiredAddtlAuth: query.requiredAddtlAuth
				? { equals: query.requiredAddtlAuth.sort(sortStrings) }
				: undefined,
		},
	});
	if (first === null) return first;

	// Upsert the cipher key if it doesn't exist
	let pubnubCipherKey = first.pubnubCipherKey;
	if (pubnubCipherKey === null) {
		pubnubCipherKey = await newPubNubCipherKey();
		await dataSource.user.update({
			where: { uid: first.uid },
			data: { pubnubCipherKey },
		});
	}

	// If the user has no pubnub_cipher_key, upsert one
	return computeRequiredAddtlAuth({ ...first, pubnubCipherKey });
}

export async function userWithUid(uid: string): Promise<User | null> {
	// Find first user whose UID matches
	return await findUserWithProperties({ uid });
}

export async function userWithAccountId(accountId: string): Promise<User | null> {
	// Find first user whose account ID matches
	return await findUserWithProperties({ currentAccountId: accountId });
}

/** A view of database data. */
interface Snapshot {
	/** The database reference. */
	ref: DocumentReference;

	/** The stored data for the reference. */
	data: Identified<AnyData> | null;
}

/**
 * Fetches the referenced data item from the database.
 *
 * @param ref A document reference.
 * @returns a view of database data.
 */
export async function fetchDbDoc(ref: DocumentReference): Promise<Snapshot> {
	console.debug(`Retrieving document at ${ref.path}...`);
	const collectionId = ref.parent.id;
	const docId = ref.id;
	switch (collectionId) {
		case "accounts":
		case "attachments":
		case "locations":
		case "tags":
		case "transactions": {
			const result = await dataSource.dataItem.findFirst({
				where: { docId, collectionId },
			});
			if (result === null) {
				console.debug(`Got nothing at ${ref.path}`);
				return { ref, data: null };
			}

			const data: Identified<DataItem> = {
				_id: result.docId,
				objectType: result.objectType,
				ciphertext: result.ciphertext,
				cryption: result.cryption ?? "v0",
			};
			console.debug(`Got document at ${ref.path}`);
			return { ref, data };
		}
		case "keys": {
			const result = await dataSource.userKeys.findUnique({ where: { userId: docId } });
			if (result === null) {
				console.debug(`Got nothing at ${ref.path}`);
				return { ref, data: null };
			}

			const data: Identified<UserKeys> = {
				_id: result.userId,
				dekMaterial: result.dekMaterial,
				oldDekMaterial: result.oldDekMaterial ?? undefined,
				oldPassSalt: result.oldPassSalt ?? undefined,
				passSalt: result.passSalt,
			};
			console.debug(`Got document at ${ref.path}`);
			return { ref, data };
		}
		case "users": {
			const rawResult = await dataSource.user.findUnique({
				where: { uid: docId },
			});
			if (rawResult === null) {
				console.debug(`Got nothing at ${ref.path}`);
				return { ref, data: null };
			}

			// Upsert the cipher key if it doesn't exist
			let pubnubCipherKey = rawResult.pubnubCipherKey;
			if (pubnubCipherKey === null) {
				pubnubCipherKey = await newPubNubCipherKey();
				await dataSource.user.update({
					where: { uid: rawResult.uid },
					data: { pubnubCipherKey },
				});
			}

			const result = computeRequiredAddtlAuth(rawResult);
			const data: Identified<User> = {
				_id: result.uid,
				uid: result.uid,
				currentAccountId: result.currentAccountId,
				mfaRecoverySeed: result.mfaRecoverySeed,
				passwordHash: result.passwordHash,
				passwordSalt: result.passwordSalt,
				pubnubCipherKey,
				requiredAddtlAuth: result.requiredAddtlAuth,
				totpSeed: result.totpSeed,
			};
			console.debug(`Got nothing at ${ref.path}`);
			return { ref, data };
		}
		default:
			throw new UnreachableCaseError(collectionId);
	}
}

/**
 * Fetches the referenced data items from the database.
 *
 * @param refs An array of document references.
 * @returns an array containing the given references and their associated data.
 */
export async function fetchDbDocs(
	refs: NonEmptyArray<DocumentReference>
): Promise<NonEmptyArray<Snapshot>> {
	// Assert same UID on all refs
	const uid = refs[0].uid;
	if (!refs.every(u => u.uid === uid))
		throw new TypeError(`Not every UID matches the first: ${uid}`);

	// Fetch the data
	// TODO: Use findMany or a transaction instead
	return (await Promise.all(refs.map(fetchDbDoc))) as NonEmptyArray<Snapshot>;
}

export function upsertUser(properties: Required<User>): PrismaPromise<Pick<DBUser, "uid">> {
	assertSchema(properties, userSchema); // assures nonempty fields
	const uid = properties.uid;

	return dataSource.user.upsert({
		select: { uid: true },
		where: { uid },
		update: properties,
		create: properties,
	});
}

export async function destroyUser(uid: string): Promise<void> {
	if (!uid) throw new TypeError("uid was empty");

	await dataSource.dataItem.deleteMany({ where: { userId: uid } });
	await dataSource.userKeys.deleteMany({ where: { userId: uid } });
	await dataSource.user.delete({ where: { uid } });
}

export interface DocUpdate {
	ref: DocumentReference;
	data: AnyData;
}

export async function upsertDbDocs(updates: Array<DocUpdate>): Promise<void> {
	if (!isNonEmptyArray(updates)) return;

	// Assert same UID on all refs
	const userId = updates[0].ref.uid;
	if (!updates.every(u => u.ref.uid === userId))
		throw new TypeError(`Not every UID matches the first: ${userId}`);

	const dataItemUpserts: Array<DataItem & { docId: string; collectionId: DataItemKey }> = [];
	const dekMaterialUpserts: Array<UserKeys> = [];
	const userUpserts: Array<User> = [];

	updates.forEach(update => {
		const collectionId = update.ref.parent.id;
		const docId = update.ref.id;
		if ("ciphertext" in update.data) {
			// DataItem
			if (!isDataItemKey(collectionId))
				throw new TypeError(`Collection ID '${collectionId}' was found with DataItem data.`);
			const data: DataItem = update.data;
			dataItemUpserts.push({ ...data, docId, collectionId });
			return;
		} else if ("dekMaterial" in update.data) {
			// Keys
			const data: UserKeys = update.data;
			dekMaterialUpserts.push(data);
			return;
		} else if ("uid" in update.data) {
			// User
			const data: User = update.data;
			const upsert = {
				uid: data.uid,
				currentAccountId: data.currentAccountId,
				passwordHash: data.passwordHash,
				passwordSalt: data.passwordSalt,
				pubnubCipherKey: data.pubnubCipherKey,
				mfaRecoverySeed: data.mfaRecoverySeed ?? null,
				totpSeed: data.totpSeed ?? null,
				requiredAddtlAuth: Array.from(new Set(data.requiredAddtlAuth?.sort(sortStrings) ?? [])),
			};
			userUpserts.push(upsert);
			return;
		}

		throw new UnreachableCaseError(update.data);
	});

	console.debug(
		`Upserting ${updates.length} records (${dataItemUpserts.length} DataItem, ${dekMaterialUpserts.length} UserKeys, ${userUpserts.length} User)...`
	);

	// FIXME: This gets REEEEEALLY slow after about 10 records
	// await dataSource.$transaction([
	await Promise.all([
		...dataItemUpserts.map(data => {
			const collectionId = data.collectionId;
			const docId = data.docId;
			const upsert = {
				ciphertext: data.ciphertext,
				objectType: data.objectType,
				cryption: data.cryption ?? "v0",
			};
			return dataSource.dataItem.upsert({
				select: { docId: true },
				where: { userId_collectionId_docId: { userId, collectionId, docId } },
				update: upsert,
				create: {
					...upsert,
					collectionId,
					docId,
					user: {
						connect: { uid: userId },
					},
				},
			});
		}),
		...dekMaterialUpserts.map(data => {
			const upsert = {
				dekMaterial: data.dekMaterial,
				passSalt: data.passSalt,
				oldDekMaterial: data.oldDekMaterial ?? null,
				oldPassSalt: data.oldPassSalt ?? null,
			};
			return dataSource.userKeys.upsert({
				select: { userId: true },
				where: { userId },
				update: upsert,
				create: {
					...upsert,
					user: {
						connect: { uid: userId },
					},
				},
			});
		}),
		...userUpserts.map(data => {
			return dataSource.user.upsert({
				select: { uid: true },
				where: { uid: userId },
				update: data,
				create: { ...data, requiredAddtlAuth: data.requiredAddtlAuth ?? [] },
			});
		}),
	]);
}

export async function deleteDbDocs(refs: NonEmptyArray<DocumentReference>): Promise<void> {
	// Assert same UID on all refs
	const uid = refs[0].uid;
	if (!refs.every(u => u.uid === uid))
		throw new TypeError(`Not every UID matches the first: ${uid}`);

	// Group refs by collection
	const dataItemRefs: Array<DocumentReference> = [];
	const keyRefs: Array<DocumentReference> = [];
	const userRefs: Array<DocumentReference> = [];

	for (const ref of refs) {
		switch (ref.parent.id) {
			case "accounts":
			case "attachments":
			case "locations":
			case "tags":
			case "transactions":
				dataItemRefs.push(ref);
				continue;
			case "keys":
				keyRefs.push(ref);
				continue;
			case "users":
				userRefs.push(ref);
				continue;
			default:
				throw new UnreachableCaseError(ref.parent.id);
		}
	}

	// Run deletes
	await dataSource.$transaction([
		// Not sure about deleteMany here, since we need each doc to match each ref
		...dataItemRefs.map(ref => {
			const collectionId = ref.parent.id;
			// We should have checked this when we grouped stuff, but ¯\_(ツ)_/¯
			if (!isDataItemKey(collectionId))
				throw new TypeError(
					`SANITY FAIL: Collection ID '${collectionId}' suddenly appeared among DataItem data.`
				);
			return dataSource.dataItem.delete({
				where: {
					userId_collectionId_docId: {
						userId: ref.uid,
						collectionId,
						docId: ref.id,
					},
				},
			});
		}),
		dataSource.userKeys.deleteMany({ where: { userId: { in: keyRefs.map(r => r.id) } } }),
		dataSource.user.deleteMany({ where: { uid: { in: userRefs.map(r => r.id) } } }),
	]);
}

export async function deleteDbDoc(ref: DocumentReference): Promise<void> {
	await deleteDbDocs([ref]);
}

export async function deleteDbCollection(ref: CollectionReference): Promise<void> {
	const uid = ref.uid;

	switch (ref.id) {
		case "accounts":
		case "attachments":
		case "locations":
		case "tags":
		case "transactions":
			await dataSource.dataItem.deleteMany({ where: { userId: uid } });
			return;
		case "keys":
			await dataSource.userKeys.deleteMany({ where: { userId: uid } });
			return;
		case "users":
			// Special handling: delete all users, and burn everything
			await dataSource.dataItem.deleteMany();
			await dataSource.userKeys.deleteMany();
			await dataSource.user.deleteMany();
			return;
		default:
			throw new UnreachableCaseError(ref.id);
	}
}
