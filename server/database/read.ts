import type {
	AESCipherKey,
	AnyData,
	DataItem,
	Hash,
	Identified,
	IdentifiedDataItem,
	Salt,
	TOTPSeed,
	UID,
	User,
	UserKeys,
} from "./schemas";
import type { CollectionReference, DocumentReference } from "./references";
import type { FileData } from "./io";
import type { JWT } from "@/auth/jwt";
import type { Logger } from "@/logger";
import { computeRequiredAddtlAuth } from "./schemas";
import { dataSource } from "./io";
import { generateAESCipherKey } from "@/auth/generators";
import { logger as defaultLogger } from "@/logger";
import { maxSpacePerUser } from "@/auth/limits";
import { NotFoundError } from "@/errors/NotFoundError";
import { publishWriteForRef } from "@/auth/pubnub";
import { UnreachableCaseError } from "@/errors/UnreachableCaseError";

interface UserStats {
	totalSpace: number;
	usedSpace: number;
}

export async function statsForUser(uid: UID): Promise<UserStats> {
	const totalSpace = Math.ceil(maxSpacePerUser);
	const usedSpace = await totalSizeOfFilesForUser(uid);

	return { totalSpace, usedSpace };
}

export async function numberOfUsers(logger: Logger | null = defaultLogger): Promise<number> {
	return await dataSource({ logger }).user.count();
}

export async function listAllUserIds(logger: Logger | null = defaultLogger): Promise<Array<UID>> {
	const users = await dataSource({ logger }).user.findMany({ select: { uid: true } });
	// Can an empty string even be a value for a primary key?
	return users.map(({ uid }) => uid as UID).filter(uid => uid);
}

// MARK: - Pseudo Large-file Storage

export async function fetchFileData(
	userId: UID,
	fileName: string,
	logger: Logger | null = defaultLogger
): Promise<FileData | null> {
	return await dataSource({ logger }).fileData.findUnique({
		where: { userId_fileName: { userId, fileName } },
	});
}

/**
 * Returns the total number of bytes that comprise a given file.
 */
// TODO: Expose this on the API
export async function totalSizeOfFile(
	userId: UID,
	fileName: string,
	logger: Logger | null = defaultLogger
): Promise<number | null> {
	const file = await dataSource({ logger }).fileData.findUnique({
		where: { userId_fileName: { userId, fileName } },
		select: { size: true },
	});
	if (file === null) throw new NotFoundError();
	return file.size;
}

/**
 * Returns the number of bytes of the user's stored files.
 */
export async function totalSizeOfFilesForUser(
	userId: UID,
	logger: Logger | null = defaultLogger
): Promise<number> {
	const files = await dataSource({ logger }).fileData.findMany({
		where: { userId },
		select: { size: true },
	});
	return files.reduce((prev, { size }) => prev + size, 0);
}

/**
 * Returns the number of files stored for the user.
 */
export async function countFileBlobsForUser(
	userId: UID,
	logger: Logger | null = defaultLogger
): Promise<number> {
	return await dataSource({ logger }).fileData.count({ where: { userId } });
}

// MARK: - Database

/**
 * Resolves to `true` if the given token exists in the database.
 */
export async function jwtExistsInDatabase(
	token: JWT,
	logger: Logger | null = defaultLogger
): Promise<boolean> {
	// FIXME: This sometimes throws when Prisma can't reach the database server. We should probs do a retry in that case.
	const result = await dataSource({ logger }).expiredJwt.findUnique({
		where: { token },
		select: { token: true },
	});
	return result !== null;
}

export async function numberOfExpiredJwts(logger: Logger | null = defaultLogger): Promise<number> {
	return await dataSource({ logger }).expiredJwt.count();
}

export async function countRecordsInCollection(
	ref: CollectionReference,
	logger: Logger | null = defaultLogger
): Promise<number> {
	switch (ref.id) {
		case "accounts":
		case "attachments":
		case "locations":
		case "tags":
		case "transactions":
		case "users":
			return await dataSource({ logger }).dataItem.count({
				where: {
					userId: ref.uid,
					collectionId: ref.id,
				},
			});
		case "keys":
			return await dataSource({ logger }).userKeys.count({
				where: { userId: ref.uid },
			});
	}
}

export async function fetchDbCollection(
	ref: CollectionReference,
	logger: Logger | null = defaultLogger
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
				await dataSource({ logger }).dataItem.findMany({
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
				await dataSource({ logger }).userKeys.findMany({
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
				passSalt: k.passSalt as Salt,
				oldDekMaterial: k.oldDekMaterial ?? undefined,
				oldPassSalt: (k.oldPassSalt as Salt | null) ?? undefined,
			}));
		default:
			throw new UnreachableCaseError(ref.id);
	}
}

async function findUserWithProperties(
	query: Partial<Pick<User, "uid" | "currentAccountId">>,
	logger: Logger | null = defaultLogger
): Promise<User | null> {
	if (Object.keys(query).length === 0) return null; // Fail gracefully for an empty query
	const first = await dataSource({ logger }).user.findFirst({
		where: {
			uid: query.uid,
			currentAccountId: query.currentAccountId,
		},
	});
	if (first === null) return first;

	// Upsert the cipher key if it doesn't exist
	let pubnubCipherKey = first.pubnubCipherKey as AESCipherKey | null;
	if (pubnubCipherKey === null) {
		pubnubCipherKey = await generateAESCipherKey();
		await dataSource({ logger }).user.update({
			where: { uid: first.uid },
			data: { pubnubCipherKey },
		});
	}

	const passwordHash = first.passwordHash as Hash;
	const passwordSalt = first.passwordSalt as Salt;
	const mfaRecoverySeed = first.mfaRecoverySeed as TOTPSeed | null;
	const totpSeed = first.totpSeed as TOTPSeed | null;

	return computeRequiredAddtlAuth({
		...first,
		uid: first.uid as UID,
		passwordHash,
		passwordSalt,
		mfaRecoverySeed: mfaRecoverySeed === "" ? null : mfaRecoverySeed,
		totpSeed: totpSeed === "" ? null : totpSeed,
		pubnubCipherKey,
	});
}

export async function userWithUid(
	uid: UID,
	logger: Logger | null = defaultLogger
): Promise<User | null> {
	// Find first user whose UID matches
	return await findUserWithProperties({ uid }, logger);
}

export async function userWithAccountId(
	accountId: string,
	logger: Logger | null = defaultLogger
): Promise<User | null> {
	// Find first user whose account ID matches
	return await findUserWithProperties({ currentAccountId: accountId }, logger);
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
export async function fetchDbDoc(
	ref: DocumentReference,
	logger: Logger | null = defaultLogger
): Promise<Snapshot> {
	logger?.debug(`Retrieving document at ${ref.path}...`);
	const collectionId = ref.parent.id;
	const docId = ref.id;
	switch (collectionId) {
		case "accounts":
		case "attachments":
		case "locations":
		case "tags":
		case "transactions":
		case "users": {
			const result = await dataSource({ logger }).dataItem.findFirst({
				where: { docId, collectionId },
			});
			if (result === null) {
				logger?.debug(`Got nothing at ${ref.path}`);
				return { ref, data: null };
			}

			const data: Identified<DataItem> = {
				_id: result.docId,
				objectType: result.objectType,
				ciphertext: result.ciphertext,
				cryption: result.cryption ?? "v0",
			};
			logger?.debug(`Got document at ${ref.path}`);
			return { ref, data };
		}
		case "keys": {
			const result = await dataSource({ logger }).userKeys.findUnique({
				where: { userId: docId },
			});
			if (result === null) {
				logger?.debug(`Got nothing at ${ref.path}`);
				return { ref, data: null };
			}

			const data: Identified<UserKeys> = {
				_id: result.userId,
				dekMaterial: result.dekMaterial,
				oldDekMaterial: result.oldDekMaterial ?? undefined,
				oldPassSalt: (result.oldPassSalt as Salt | null) ?? undefined,
				passSalt: result.passSalt as Salt,
			};
			logger?.debug(`Got document at ${ref.path}`);
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
	refs: ReadonlyNonEmptyArray<DocumentReference>,
	logger: Logger | null = defaultLogger
): Promise<NonEmptyArray<Snapshot>> {
	// Assert same UID on all refs
	const uid = refs[0].uid;
	if (!refs.every(u => u.uid === uid))
		throw new TypeError(`Not every UID matches the first: ${uid}`);

	// Fetch the data
	// TODO: Use findMany or a transaction instead
	return (await Promise.all(refs.map(doc => fetchDbDoc(doc, logger)))) as NonEmptyArray<Snapshot>;
}

// MARK: - Watchers

export type Unsubscribe = () => void;

type SDataChangeCallback = (newData: Readonly<IdentifiedDataItem> | null) => void;
type PDataChangeCallback = (newData: ReadonlyArray<Readonly<IdentifiedDataItem>>) => void;

interface _Watcher {
	readonly plurality: "single" | "plural";
	readonly id: string;
	readonly onChange: SDataChangeCallback | PDataChangeCallback;
}

interface DocumentWatcher extends _Watcher {
	readonly plurality: "single";
	readonly collectionId: string;
	readonly onChange: SDataChangeCallback;
}

interface CollectionWatcher extends _Watcher {
	readonly plurality: "plural";
	readonly onChange: PDataChangeCallback;
}

// TODO: Cloudflare doesn't like global state. Figure another way to do this. Durable Objects?
const documentWatchers = new Map<string, DocumentWatcher>();
const collectionWatchers = new Map<string, CollectionWatcher>();

export function watchUpdatesToDocument(
	ref: DocumentReference,
	onChange: SDataChangeCallback
): Unsubscribe {
	defaultLogger.debug(`Watching updates to document at ${ref.path}`);
	const handle: DocumentWatcher = {
		id: ref.id,
		collectionId: ref.parent.id,
		onChange,
		plurality: "single",
	};
	documentWatchers.set(handle.id, handle);

	// Send all data at path
	/* eslint-disable promise/prefer-await-to-then */
	void fetchDbDoc(ref)
		.then(async ({ ref, data }) => {
			if (data) {
				await informWatchersForDocument(ref, data);
			}
		})
		.catch((error: unknown) => {
			defaultLogger.error(
				`Error on initial data load from document watcher at path ${ref.path}:`,
				error
			);
			defaultLogger.debug(
				`Removing listener '${handle.id}' for document ${ref.path} due to error on initial load`
			);
			documentWatchers.delete(handle.id);
		});
	/* eslint-enable promise/prefer-await-to-then */

	return (): void => {
		defaultLogger.debug(`Removing listener '${handle.id}' for document ${ref.path}`);
		documentWatchers.delete(handle.id);
	};
}

export function watchUpdatesToCollection(
	ref: CollectionReference,
	onChange: PDataChangeCallback
): Unsubscribe {
	const handle: CollectionWatcher = { id: ref.id, onChange, plurality: "plural" };
	collectionWatchers.set(handle.id, handle);

	// Send "added" for all data at path
	/* eslint-disable promise/prefer-await-to-then */
	void fetchDbCollection(ref)
		.then(async data => {
			await informWatchersForCollection(ref, data);
		})
		.catch((error: unknown) => {
			defaultLogger.error(
				`Error on initial data load from collection watcher at path ${ref.path}:`,
				error
			);
			defaultLogger.debug(
				`Removing listener '${handle.id}' for collection ${ref.path} due to error on initial load`
			);
			collectionWatchers.delete(handle.id);
		});
	/* eslint-enable promise/prefer-await-to-then */

	return (): void => {
		defaultLogger.debug(`Removing listener '${handle.id}' for collection ${ref.path}`);
		collectionWatchers.delete(handle.id);
	};
}

export async function informWatchersForDocument(
	ref: DocumentReference,
	newItem: Readonly<IdentifiedDataItem> | null
): Promise<void> {
	const docListeners = Array.from(documentWatchers.values()).filter(
		w => w.id === ref.id && w.collectionId === ref.parent.id
	);
	const collectionListeners = Array.from(collectionWatchers.values()) //
		.filter(w => w.id === ref.parent.id);

	if (docListeners.length + collectionListeners.length > 0) {
		defaultLogger.debug(
			`Informing ${
				docListeners.length + collectionListeners.length
			} listener(s) about changes to document ${ref.path}`
		);
	}
	await Promise.all(docListeners.map(l => l.onChange(newItem)));
	await publishWriteForRef(ref, newItem);
	const newCollection = await fetchDbCollection(ref.parent);
	await Promise.all(collectionListeners.map(l => l.onChange(newCollection)));
	await publishWriteForRef(ref.parent, newCollection);
}

export async function informWatchersForCollection(
	ref: CollectionReference,
	newItems: ReadonlyArray<IdentifiedDataItem>
): Promise<void> {
	const listeners = Array.from(collectionWatchers.values()) //
		.filter(w => w.id === ref.id);

	if (listeners.length > 0) {
		defaultLogger.debug(
			`Informing ${listeners.length} listener(s) about changes to collection ${ref.path}`
		);
	}
	await Promise.all(listeners.map(l => l.onChange(newItems)));
	await publishWriteForRef(ref, newItems);
}
