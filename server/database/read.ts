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
import type { Context } from "hono";
import type { FileData } from "./io";
import type { JWT } from "../auth/jwt";
import type { Logger } from "../logger";
import { computeRequiredAddtlAuth } from "./schemas";
import { dataSource } from "./io";
import { generateAESCipherKey } from "../auth/generators";
import { logger as defaultLogger } from "../logger";
import { maxStorageSpacePerUser } from "../auth/limits";
import { NotFoundError } from "../errors/NotFoundError";
import { publishWriteForRef } from "../auth/pubnub";
import { UnreachableCaseError } from "../errors/UnreachableCaseError";

interface UserStats {
	/** The total amount of bytes allocated to a user. */
	totalSpace: number;

	/** The amount of bytes a user has used already. */
	usedSpace: number;
}

/**
 * Returns the available space in bytes of a user.
 */
export async function statsForUser(c: Context<Env>, uid: UID): Promise<UserStats> {
	const totalSpace = Math.ceil(maxStorageSpacePerUser(c));
	const usedSpace = await totalSizeOfFilesForUser(c, uid);

	return { totalSpace, usedSpace };
}

/**
 * Returns the total number of registered users.
 */
export async function numberOfUsers(
	c: Pick<Context<Env>, "env">,
	logger: Logger | null = defaultLogger
): Promise<number> {
	return await dataSource({ context: c, logger }).user.count();
}

/**
 * Returns an array containing the registered user IDs.
 */
export async function listAllUserIds(
	c: Pick<Context<Env>, "env">,
	logger: Logger | null = defaultLogger
): Promise<Array<UID>> {
	const users = await dataSource({ context: c, logger }).user.findMany({ select: { uid: true } });
	// Can an empty string even be a value for a primary key?
	return users.map(({ uid }) => uid as UID).filter(uid => uid);
}

// MARK: - Pseudo Large-file Storage

/**
 * Retrieves the contents of a large file.
 *
 * @param c The request context.
 * @param userId The owner of the file.
 * @param fileName The name of the file.
 * @param logger A logger interface.
 */
export async function fetchFileData(
	c: Context<Env>,
	userId: UID,
	fileName: string,
	logger: Logger | null = defaultLogger
): Promise<FileData | null> {
	return await dataSource({ context: c, logger }).fileData.findUnique({
		where: { userId_fileName: { userId, fileName } },
	});
}

/**
 * Returns the total number of bytes that comprise a given file.
 */
// TODO: Expose this on the API
export async function totalSizeOfFile(
	c: Context<Env>,
	userId: UID,
	fileName: string,
	logger: Logger | null = defaultLogger
): Promise<number | null> {
	const file = await dataSource({ context: c, logger }).fileData.findUnique({
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
	c: Context<Env>,
	userId: UID,
	logger: Logger | null = defaultLogger
): Promise<number> {
	const files = await dataSource({ context: c, logger }).fileData.findMany({
		where: { userId },
		select: { size: true },
	});
	return files.reduce((prev, { size }) => prev + size, 0);
}

/**
 * Returns the number of files stored for the user.
 */
export async function countFileBlobsForUser(
	c: Pick<Context<Env>, "env">,
	userId: UID,
	logger: Logger | null = defaultLogger
): Promise<number> {
	return await dataSource({ context: c, logger }).fileData.count({ where: { userId } });
}

// MARK: - Database

/**
 * Returns a promise that resolves to `true` if the given token exists in the database.
 */
export async function jwtExistsInDatabase(
	c: Pick<Context<Env>, "env">,
	token: JWT,
	logger: Logger | null = defaultLogger
): Promise<boolean> {
	// FIXME: This sometimes throws when Prisma can't reach the database server. We should probs do a retry in that case.
	const result = await dataSource({ context: c, logger }).expiredJwt.findUnique({
		where: { token },
		select: { token: true },
	});
	return result !== null;
}

/**
 * Returns the number of expired session tokens.
 */
export async function numberOfExpiredJwts(
	c: Pick<Context<Env>, "env">,
	logger: Logger | null = defaultLogger
): Promise<number> {
	return await dataSource({ context: c, logger }).expiredJwt.count();
}

/**
 * Returns the number of documents in a given collection.
 *
 * @param c The request context.
 * @param ref The collection to read.
 * @param logger A logger interface.
 */
export async function countRecordsInCollection(
	c: Pick<Context<Env>, "env">,
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
			return await dataSource({ context: c, logger }).dataItem.count({
				where: {
					userId: ref.uid,
					collectionId: ref.id,
				},
			});
		case "keys":
			return await dataSource({ context: c, logger }).userKeys.count({
				where: { userId: ref.uid },
			});
	}
}

/**
 * Returns the contents of a given collection.
 *
 * @param c The request context.
 * @param ref The collection to read.
 * @param logger A logger interface.
 */
export async function fetchDbCollection(
	c: Pick<Context<Env>, "env">,
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
				await dataSource({ context: c, logger }).dataItem.findMany({
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
				await dataSource({ context: c, logger }).userKeys.findMany({
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
	c: Pick<Context<Env>, "env">,
	query: Partial<Pick<User, "uid" | "currentAccountId">>,
	logger: Logger | null = defaultLogger
): Promise<User | null> {
	if (Object.keys(query).length === 0) return null; // Fail gracefully for an empty query
	const first = await dataSource({ context: c, logger }).user.findFirst({
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
		await dataSource({ context: c, logger }).user.update({
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

/**
 * Returns a user document that has the given `uid`, or `null` if none are found.
 *
 * @param c The request context.
 * @param uid The ID of the user to find.
 * @param logger A logger interface.
 */
export async function userWithUid(
	c: Pick<Context<Env>, "env">,
	uid: UID,
	logger: Logger | null = defaultLogger
): Promise<User | null> {
	// Find first user whose UID matches
	return await findUserWithProperties(c, { uid }, logger);
}

/**
 * Returns a user document that has the given `accountId`, or `null` if none are found.
 *
 * @param c The request context.
 * @param accountId The current account ID of the user to find.
 * @param logger A logger interface.
 */
export async function userWithAccountId(
	c: Pick<Context<Env>, "env">,
	accountId: string,
	logger: Logger | null = defaultLogger
): Promise<User | null> {
	// Find first user whose account ID matches
	return await findUserWithProperties(c, { currentAccountId: accountId }, logger);
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
	c: Pick<Context<Env>, "env">,
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
			const result = await dataSource({ context: c, logger }).dataItem.findFirst({
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
			const result = await dataSource({ context: c, logger }).userKeys.findUnique({
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
	c: Context<Env>,
	refs: ReadonlyNonEmptyArray<DocumentReference>,
	logger: Logger | null = defaultLogger
): Promise<NonEmptyArray<Snapshot>> {
	// Assert same UID on all refs
	const uid = refs[0].uid;
	if (!refs.every(u => u.uid === uid))
		throw new TypeError(`Not every UID matches the first: ${uid}`);

	// Fetch the data
	// TODO: Use findMany or a transaction instead
	return (await Promise.all(
		refs.map(doc => fetchDbDoc(c, doc, logger))
	)) as NonEmptyArray<Snapshot>;
}

// MARK: - Watchers

/** A function which, when called, invalidates the watcher that returned it. */
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

/**
 * Begins listening for updates to a given document.
 *
 * @param c The request context that initiated the watch.
 * @param ref The document to watch.
 * @param onChange A function to call when the document is changed.
 * @returns A function that tears down the listener when called.
 */
export function watchUpdatesToDocument(
	c: Pick<Context<Env>, "env">,
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
	void fetchDbDoc(c, ref)
		.then(async ({ ref, data }) => {
			if (data) {
				await informWatchersForDocument(c, ref, data);
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

/**
 * Begins listening for updates to documents in a given collection.
 *
 * @param c The request context that initiated the watch.
 * @param ref The document to watch.
 * @param onChange A function to call when the document is changed.
 * @returns A function that tears down the listener when called.
 */
export function watchUpdatesToCollection(
	c: Context<Env>,
	ref: CollectionReference,
	onChange: PDataChangeCallback
): Unsubscribe {
	const handle: CollectionWatcher = { id: ref.id, onChange, plurality: "plural" };
	collectionWatchers.set(handle.id, handle);

	// Send "added" for all data at path
	/* eslint-disable promise/prefer-await-to-then */
	void fetchDbCollection(c, ref)
		.then(async data => {
			await informWatchersForCollection(c, ref, data);
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

/**
 * Informs all active watchers for the given document that it was changed.
 * Also tells PubNub.
 *
 * @param c The request context.
 * @param ref The document that changed.
 * @param newItem The new data.
 */
export async function informWatchersForDocument(
	c: Pick<Context<Env>, "env">,
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
	await publishWriteForRef(c, ref, newItem);
	const newCollection = await fetchDbCollection(c, ref.parent);
	await Promise.all(collectionListeners.map(l => l.onChange(newCollection)));
	await publishWriteForRef(c, ref.parent, newCollection);
}

/**
 * Informs all active watchers for the given collection that it was changed.
 * Also tells PubNub.
 *
 * @param c The request context.
 * @param ref The collection that changed.
 * @param newItem The new data.
 */
export async function informWatchersForCollection(
	c: Pick<Context<Env>, "env">,
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
	await publishWriteForRef(c, ref, newItems);
}
