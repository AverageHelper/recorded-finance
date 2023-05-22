import type { AnyData, DataItem, DataItemKey, UID, User, UserKeys } from "./schemas";
import type { CollectionReference, DocumentReference } from "./references";
import type { FileData, PrismaPromise, RawUser } from "./io";
import type { JWT } from "../auth/jwt";
import type { Logger } from "../logger";
import { assertSchema, isDataItemKey, isNonEmptyArray, user as userSchema } from "./schemas";
import { dataSource } from "./io";
import { logger as defaultLogger } from "../logger";
import { ONE_HOUR } from "../constants/time";
import { UnreachableCaseError } from "../errors/UnreachableCaseError";
import {
	fetchDbDoc,
	fetchDbDocs,
	informWatchersForCollection,
	informWatchersForDocument,
} from "./read";

// MARK: - Pseudo Large-file Storage

/**
 * Stores the given file data, replacing existing data if it already exists.
 */
export function upsertFileData(
	attachment: Omit<FileData, "size">,
	logger: Logger | null = defaultLogger
): PrismaPromise<Pick<FileData, "size">> {
	const userId = attachment.userId;
	const fileName = attachment.fileName;
	const contents = attachment.contents;
	const size = contents.length;

	return dataSource({ logger }).fileData.upsert({
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
export async function destroyFileData(
	userId: UID,
	fileName: string,
	logger: Logger | null = defaultLogger
): Promise<number> {
	const file = await dataSource({ logger }).fileData.delete({
		where: { userId_fileName: { userId, fileName } },
		select: { size: true },
	});
	return file?.size ?? 0;
}

// MARK: - Database

/**
 * Stores the given token in a blacklist.
 *
 * The blacklist assumes that the JWT has an hour-long expiration
 * window. Values will be purged sometime after that expiration
 * window elapses.
 */
export async function addJwtToDatabase(
	token: JWT,
	logger: Logger | null = defaultLogger
): Promise<void> {
	await dataSource({ logger }).expiredJwt.upsert({
		where: { token },
		update: {}, // nop if the value already exists
		create: { token }, // database generates the timestamp
	});
}

/**
 * Purges the database of expired JWTs older than two hours.
 */
export async function purgeExpiredJwts(logger: Logger | null = defaultLogger): Promise<void> {
	const twoHrsAgo = new Date(new Date().getTime() - 2 * ONE_HOUR);
	await dataSource({ logger }).expiredJwt.deleteMany({
		where: {
			createdAt: { lte: twoHrsAgo },
		},
	});
}

export function upsertUser(
	properties: Required<User>,
	logger: Logger | null = defaultLogger
): PrismaPromise<Pick<RawUser, "uid">> {
	assertSchema(properties, userSchema); // assures nonempty fields
	const uid = properties.uid;

	return dataSource({ logger }).user.upsert({
		select: { uid: true },
		where: { uid },
		update: properties,
		create: properties,
	});
}

export async function destroyUser(uid: UID, logger: Logger | null = defaultLogger): Promise<void> {
	if (uid === "") throw new TypeError("uid was empty");

	await dataSource({ logger }).dataItem.deleteMany({ where: { userId: uid } });
	await dataSource({ logger }).userKeys.deleteMany({ where: { userId: uid } });
	await dataSource({ logger }).user.delete({ where: { uid } });
}

export interface DocUpdate {
	ref: DocumentReference;
	data: AnyData;
}

export async function upsertDbDocs(
	updates: ReadonlyArray<DocUpdate>,
	logger: Logger | null = defaultLogger
): Promise<void> {
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
		}

		throw new UnreachableCaseError(update.data);
	});

	logger?.debug(
		`Upserting ${updates.length} records (${dataItemUpserts.length} DataItem, ${dekMaterialUpserts.length} UserKeys, ${userUpserts.length} User)...`
	);

	// FIXME: This gets REEEEEALLY slow after about 10 records
	// await dataSource({ logger }).$transaction([
	await Promise.all([
		...dataItemUpserts.map(data => {
			const collectionId = data.collectionId;
			const docId = data.docId;
			const upsert = {
				ciphertext: data.ciphertext,
				objectType: data.objectType,
				cryption: data.cryption ?? "v0",
			};
			return dataSource({ logger }).dataItem.upsert({
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
			return dataSource({ logger }).userKeys.upsert({
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
			return dataSource({ logger }).user.upsert({
				select: { uid: true },
				where: { uid: userId },
				update: data,
				create: { ...data, requiredAddtlAuth: data.requiredAddtlAuth ?? [] },
			});
		}),
	]);
}

export async function deleteDbDocs(
	refs: ReadonlyNonEmptyArray<DocumentReference>,
	logger: Logger | null = defaultLogger
): Promise<void> {
	// Assert same UID on all refs
	const uid = refs[0].uid;
	if (!refs.every(u => u.uid === uid))
		throw new TypeError(`Not every UID matches the first: ${uid}`);

	// Group refs by collection
	const dataItemRefs: Array<DocumentReference> = [];
	const keyRefs: Array<DocumentReference> = [];

	for (const ref of refs) {
		switch (ref.parent.id) {
			case "accounts":
			case "attachments":
			case "locations":
			case "tags":
			case "transactions":
			case "users":
				dataItemRefs.push(ref);
				continue;
			case "keys":
				keyRefs.push(ref);
				continue;
			default:
				throw new UnreachableCaseError(ref.parent.id);
		}
	}

	// Run deletes
	await dataSource({ logger }).$transaction([
		// Not sure about deleteMany here, since we need each doc to match each ref
		...dataItemRefs.map(ref => {
			const collectionId = ref.parent.id;
			// We should have checked this when we grouped stuff, but ¯\_(ツ)_/¯
			if (!isDataItemKey(collectionId))
				throw new TypeError(
					`SANITY FAIL: Collection ID '${collectionId}' suddenly appeared among DataItem data.`
				);
			return dataSource({ logger }).dataItem.delete({
				where: {
					userId_collectionId_docId: {
						userId: ref.uid,
						collectionId,
						docId: ref.id,
					},
				},
			});
		}),
		dataSource({ logger }).userKeys.deleteMany({
			where: { userId: { in: keyRefs.map(r => r.id) } },
		}),
	]);
}

export async function deleteDbDoc(ref: DocumentReference): Promise<void> {
	await deleteDbDocs([ref]);
}

export async function deleteDbCollection(
	ref: CollectionReference,
	logger: Logger | null = defaultLogger
): Promise<void> {
	const uid = ref.uid;

	switch (ref.id) {
		case "accounts":
		case "locations":
		case "tags":
		case "transactions":
		case "users":
			await dataSource({ logger }).dataItem.deleteMany({
				where: { userId: uid, collectionId: ref.id },
			});
			return;
		case "attachments": {
			const db = dataSource({ logger });
			await db.$transaction([
				db.dataItem.deleteMany({
					where: { userId: uid, collectionId: ref.id },
				}),
				db.fileData.deleteMany({
					where: { userId: uid },
				}),
			]);
			return;
		}
		case "keys":
			await dataSource({ logger }).userKeys.deleteMany({ where: { userId: uid } });
			return;
		default:
			throw new UnreachableCaseError(ref.id);
	}
}

export async function deleteDocuments(
	refs: ReadonlyNonEmptyArray<DocumentReference>
): Promise<void> {
	// Fetch the data
	const before = await fetchDbDocs(refs);

	// Delete the stored data
	await deleteDbDocs(refs);

	// Tell listeners what happened
	for (const { ref, data } of before) {
		// Only call listeners about deletion if it wasn't gone in the first place
		if (!data) continue;
		await informWatchersForDocument(ref, null);
	}
}

export async function deleteDocument(ref: DocumentReference): Promise<void> {
	// Fetch the data
	const { data: oldData } = await fetchDbDoc(ref);

	// Delete the stored data
	await deleteDbDoc(ref);

	// Tell listeners what happened
	if (oldData) {
		// Only call listeners about deletion if it wasn't gone in the first place
		await informWatchersForDocument(ref, null);
	}
}

export async function deleteCollection(ref: CollectionReference): Promise<void> {
	await deleteDbCollection(ref);

	// Tell listeners what happened
	await informWatchersForCollection(ref, []);
}

export async function setDocuments(updates: ReadonlyNonEmptyArray<DocUpdate>): Promise<void> {
	await upsertDbDocs(updates);

	// Tell listeners what happened
	// TODO: Do we need to read a "before" value for these too?
	for (const { ref, data } of updates) {
		await informWatchersForDocument(ref, { ...data, _id: ref.id });
	}
}

export async function setDocument(ref: DocumentReference, data: AnyData): Promise<void> {
	await setDocuments([{ ref, data }]);
}
