import type { AnyData, DataItem, Identified, IdentifiedDataItem, User, UserKeys } from "./schemas";
import type { CollectionReference, DocumentReference } from "./references";
import type { FileData } from "@prisma/client";
import { computeRequiredAddtlAuth } from "./schemas";
import { dataSource } from "./io";
import { generateAESCipherKey } from "../auth/generators";
import { logger } from "../logger";
import { maxSpacePerUser } from "../auth/limits";
import { NotFoundError } from "../errors/NotFoundError";
import { UnreachableCaseError } from "../errors/UnreachableCaseError";

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
	return await dataSource().user.count();
}

export async function listAllUserIds(): Promise<Array<string>> {
	const users = await dataSource().user.findMany({ select: { uid: true } });
	return users.map(({ uid }) => uid);
}

// MARK: - Pseudo Large-file Storage

export async function fetchFileData(userId: string, fileName: string): Promise<FileData | null> {
	return await dataSource().fileData.findUnique({
		where: { userId_fileName: { userId, fileName } },
	});
}

/**
 * Returns the total number of bytes that comprise a given file.
 */
export async function totalSizeOfFile(userId: string, fileName: string): Promise<number | null> {
	const file = await dataSource().fileData.findUnique({
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
	const files = await dataSource().fileData.findMany({
		where: { userId },
		select: { size: true },
	});
	return files.reduce((prev, { size }) => prev + size, 0);
}

/**
 * Returns the number of files stored for the user.
 */
export async function countFileBlobsForUser(userId: string): Promise<number> {
	return await dataSource().fileData.count({ where: { userId } });
}

// MARK: - Database

/**
 * Resolves to `true` if the given token exists in the database.
 */
export async function jwtExistsInDatabase(token: string): Promise<boolean> {
	const result = await dataSource().expiredJwt.findUnique({
		where: { token },
		select: { token: true },
	});
	return result !== null;
}

export async function numberOfExpiredJwts(): Promise<number> {
	return await dataSource().expiredJwt.count();
}

export async function countRecordsInCollection(ref: CollectionReference): Promise<number> {
	switch (ref.id) {
		case "accounts":
		case "attachments":
		case "locations":
		case "tags":
		case "transactions":
		case "users":
			return await dataSource().dataItem.count({
				where: {
					userId: ref.uid,
					collectionId: ref.id,
				},
			});
		case "keys":
			return await dataSource().userKeys.count({
				where: { userId: ref.uid },
			});
	}
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
		case "users":
			return (
				await dataSource().dataItem.findMany({
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
				await dataSource().userKeys.findMany({
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
		default:
			throw new UnreachableCaseError(ref.id);
	}
}

async function findUserWithProperties(
	query: Partial<Pick<User, "uid" | "currentAccountId">>
): Promise<User | null> {
	if (Object.keys(query).length === 0) return null; // Fail gracefully for an empty query
	const first = await dataSource().user.findFirst({
		where: {
			uid: query.uid,
			currentAccountId: query.currentAccountId,
		},
	});
	if (first === null) return first;

	// Upsert the cipher key if it doesn't exist
	let pubnubCipherKey = first.pubnubCipherKey;
	if (pubnubCipherKey === null) {
		pubnubCipherKey = await generateAESCipherKey();
		await dataSource().user.update({
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
	logger.debug(`Retrieving document at ${ref.path}...`);
	const collectionId = ref.parent.id;
	const docId = ref.id;
	switch (collectionId) {
		case "accounts":
		case "attachments":
		case "locations":
		case "tags":
		case "transactions":
		case "users": {
			const result = await dataSource().dataItem.findFirst({
				where: { docId, collectionId },
			});
			if (result === null) {
				logger.debug(`Got nothing at ${ref.path}`);
				return { ref, data: null };
			}

			const data: Identified<DataItem> = {
				_id: result.docId,
				objectType: result.objectType,
				ciphertext: result.ciphertext,
				cryption: result.cryption ?? "v0",
			};
			logger.debug(`Got document at ${ref.path}`);
			return { ref, data };
		}
		case "keys": {
			const result = await dataSource().userKeys.findUnique({ where: { userId: docId } });
			if (result === null) {
				logger.debug(`Got nothing at ${ref.path}`);
				return { ref, data: null };
			}

			const data: Identified<UserKeys> = {
				_id: result.userId,
				dekMaterial: result.dekMaterial,
				oldDekMaterial: result.oldDekMaterial ?? undefined,
				oldPassSalt: result.oldPassSalt ?? undefined,
				passSalt: result.passSalt,
			};
			logger.debug(`Got document at ${ref.path}`);
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
