import type { CollectionReference, DocumentReference } from "./references.js";
import type {
	AnyData,
	DataItem,
	Identified,
	IdentifiedDataItem,
	User,
	UserKeys,
} from "./schemas.js";
import { assertSchema, isDataItemKey, user as userSchema } from "./schemas.js";
import { folderSize, maxSpacePerUser } from "../auth/limits.js";
import { join as joinPath } from "node:path";
import { PrismaClient } from "@prisma/client";
import { requireEnv } from "../environment.js";
import { UnreachableCaseError } from "../errors/index.js";

// Start connecting to the database
const dataSource = new PrismaClient();
process.stdout.write("Connected to MongoDB\n");

// Profile database accesses
dataSource.$use(async (params, next) => {
	const before = Date.now();
	const result: unknown = await next(params);
	const after = Date.now();
	console.debug(`Query ${params.model ?? "undefined"}.${params.action} took ${after - before}ms`);
	return result;
});

// The place where the user's encrypted attachments live
function dbFolderForUser(uid: string): string {
	const DB_ROOT = requireEnv("DB"); // TODO: Move this to the database
	const dir = joinPath(DB_ROOT, "users", uid);
	console.debug(`dbFolderForUser(uid: ${uid}) ${dir}`);
	return dir;
}

interface UserStats {
	totalSpace: number;
	usedSpace: number;
}

export async function statsForUser(uid: string): Promise<UserStats> {
	const folder = dbFolderForUser(uid);
	const totalSpace = Math.ceil(maxSpacePerUser);
	const usedSpace = Math.ceil((await folderSize(folder)) ?? totalSpace);

	return { totalSpace, usedSpace };
}

export async function numberOfUsers(): Promise<number> {
	return await dataSource.user.count();
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
		case "users":
			// Special handling: fetch all users
			return await dataSource.user.findMany();
		default:
			throw new UnreachableCaseError(ref.id);
	}
}

export async function findUserWithProperties(query: Partial<User>): Promise<User | null> {
	if (Object.keys(query).length === 0) return null; // Fail gracefully for an empty query
	return await dataSource.user.findFirst({
		where: {
			...query,
			requiredAddtlAuth: {
				every: {
					type: query.requiredAddtlAuth?.includes("totp") === true ? "totp" : undefined,
				},
			},
		},
	});
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
			if (result === null) return { ref, data: null };

			const data: Identified<DataItem> = {
				_id: result.docId,
				objectType: result.objectType,
				ciphertext: result.ciphertext,
				cryption: result.cryption ?? "v0",
			};
			return { ref, data };
		}
		case "keys": {
			const result = await dataSource.userKeys.findUnique({ where: { userId: docId } });
			if (result === null) return { ref, data: null };

			const data: Identified<UserKeys> = {
				_id: result.userId,
				dekMaterial: result.dekMaterial,
				oldDekMaterial: result.oldDekMaterial ?? undefined,
				oldPassSalt: result.oldPassSalt ?? undefined,
				passSalt: result.passSalt,
			};
			return { ref, data };
		}
		case "users": {
			const result = await dataSource.user.findUnique({
				where: { uid: docId },
				include: { requiredAddtlAuth: true },
			});
			if (result === null) return { ref, data: null };

			const data: Identified<User> = {
				_id: result.uid,
				uid: result.uid,
				currentAccountId: result.currentAccountId,
				mfaRecoverySeed: result.mfaRecoverySeed,
				passwordHash: result.passwordHash,
				passwordSalt: result.passwordSalt,
				requiredAddtlAuth: result.requiredAddtlAuth.map(a => a.type),
				totpSeed: result.totpSeed,
			};
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

export async function upsertUser(properties: Required<User>): Promise<void> {
	assertSchema(properties, userSchema); // assures nonempty fields
	const uid = properties.uid;

	await dataSource.user.upsert({
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

export async function upsertDbDocs(updates: NonEmptyArray<DocUpdate>): Promise<void> {
	// Assert same UID on all refs
	const uid = updates[0].ref.uid;
	if (!updates.every(u => u.ref.uid === uid))
		throw new TypeError(`Not every UID matches the first: ${uid}`);

	await Promise.all(
		updates.map(async update => {
			const collectionId = update.ref.parent.id;
			const docId = update.ref.id;
			const userId = update.ref.uid;
			if ("ciphertext" in update.data) {
				if (!isDataItemKey(collectionId))
					throw new TypeError(`Collection ID '${collectionId}' was found with DataItem data.`);
				const data: DataItem = update.data;
				await dataSource.dataItem.upsert({
					where: { userId_collectionId_docId: { userId, collectionId, docId } },
					update: {
						ciphertext: data.ciphertext,
						objectType: data.objectType,
						cryption: data.cryption,
					},
					create: {
						ciphertext: data.ciphertext,
						objectType: data.objectType,
						cryption: data.cryption,
						collectionId,
						docId,
						user: {
							connect: { uid: userId },
						},
					},
				});
				return;
			} else if ("dekMaterial" in update.data) {
				const data: UserKeys = update.data;
				await dataSource.userKeys.upsert({
					where: { userId: docId },
					update: {
						dekMaterial: data.dekMaterial,
						passSalt: data.passSalt,
						oldDekMaterial: data.oldDekMaterial,
						oldPassSalt: data.oldPassSalt,
					},
					create: {
						dekMaterial: data.dekMaterial,
						passSalt: data.passSalt,
						oldDekMaterial: data.oldDekMaterial,
						oldPassSalt: data.oldPassSalt,
						user: {
							connect: { uid: userId },
						},
					},
				});
				return;
			} else if ("uid" in update.data) {
				const data: User = update.data;
				await dataSource.user.upsert({
					where: { uid: docId },
					update: {
						uid: data.uid,
						currentAccountId: data.currentAccountId,
						passwordHash: data.passwordHash,
						passwordSalt: data.passwordSalt,
						mfaRecoverySeed: data.mfaRecoverySeed,
						totpSeed: data.totpSeed,
						requiredAddtlAuth: data.requiredAddtlAuth?.[0]
							? {
									connectOrCreate: {
										where: { type: data.requiredAddtlAuth[0] },
										create: { type: data.requiredAddtlAuth[0] },
									},
							  }
							: undefined,
					},
					create: {
						uid: data.uid,
						currentAccountId: data.currentAccountId,
						passwordHash: data.passwordHash,
						passwordSalt: data.passwordSalt,
						mfaRecoverySeed: data.mfaRecoverySeed,
						totpSeed: data.totpSeed,
						requiredAddtlAuth: data.requiredAddtlAuth?.[0]
							? {
									connectOrCreate: {
										where: { type: data.requiredAddtlAuth[0] },
										create: { type: data.requiredAddtlAuth[0] },
									},
							  }
							: undefined,
					},
				});
				return;
			}

			throw new UnreachableCaseError(update.data);
		})
	);
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
	// TODO: Use deleteMany instead
	await dataSource.$transaction([
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
		...keyRefs.map(ref => dataSource.userKeys.delete({ where: { userId: ref.id } })),
		...userRefs.map(ref => dataSource.user.delete({ where: { uid: ref.id } })),
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
