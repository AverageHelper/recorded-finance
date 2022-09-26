import type {
	AnyData,
	DataItem,
	Identified,
	IdentifiedDataItem,
	User,
	UserKeys,
} from "./schemas.js";
import {
	allCollectionIds,
	assertSchema,
	computeRequiredAddtlAuth,
	dataItem as dataItemSchema,
	isDataItemKey,
	isNonEmptyArray,
	sortStrings,
	user as userSchema,
	userKeys as userKeysSchema,
} from "./schemas.js";
import { CollectionReference, DocumentReference } from "./references.js";
import { ensure, resolvePath } from "./filesystem.js";
import { folderSize, maxSpacePerUser } from "../auth/limits.js";
import { is } from "superstruct";
import { join as joinPath } from "node:path";
import { Low, JSONFile } from "lowdb";
import { PrismaClient } from "@prisma/client";
import { requireEnv } from "../environment.js";
import { UnreachableCaseError } from "../errors/index.js";
import { useJobQueue } from "@averagehelper/job-queue";

const MIGRATION_DRY_RUN = true;

const DB_DIR = resolvePath(requireEnv("DB"));
process.stdout.write(`Legacy database and storage directory: ${DB_DIR}\n`);

export async function migrateLegacyData(): Promise<void> {
	type UserIndexDb = Record<string, User>;
	type UserDb = Record<string, Record<string, AnyData>>;

	const identity = <T>(t: T): T => t;

	async function userIndexDb<T>(
		cb: (db: UserIndexDb | null, write: (n: UserIndexDb | null) => void) => T
	): Promise<T>;

	async function userIndexDb(
		cb: (db: UserIndexDb | null, write: (n: UserIndexDb | null) => void) => unknown
	): Promise<unknown> {
		await ensure(DB_DIR);
		const file = joinPath(DB_DIR, "users.json");
		const adapter = new JSONFile<UserIndexDb>(file);
		const db = new Low(adapter);
		await db.read();

		const data = db.data ? { ...db.data } : null;
		const writeQueue = useJobQueue<Low<UserIndexDb>>(file);
		const result = cb(data, newData => {
			writeQueue.process(db => db.write());
			db.data = newData;
			writeQueue.createJob(db);
		});

		if (writeQueue.length === 0) return result;
		return await new Promise(resolve => {
			writeQueue.on("finish", () => resolve(result));
		});
	}

	async function dbForUser(uid: string): Promise<UserDb | null>;
	async function dbForUser<T>(
		uid: string,
		cb: (db: UserDb | null, write: (n: UserDb | null) => void) => T
	): Promise<T>;

	async function dbForUser(
		uid: string,
		cb: (db: UserDb | null, write: (n: UserDb | null) => void) => unknown = identity
	): Promise<unknown> {
		if (!uid) throw new TypeError("uid should not be empty");

		const folder = dbFolderForUser(uid);
		await ensure(folder);

		const file = joinPath(folder, "db.json");
		const adapter = new JSONFile<UserDb>(file);
		const db = new Low(adapter);
		await db.read();

		const data = db.data ? { ...db.data } : null;
		const writeQueue = useJobQueue<Low<UserDb>>(file);
		const result = cb(data, newData => {
			writeQueue.process(db => db.write());
			db.data = newData;
			writeQueue.createJob(db);
		});

		if (writeQueue.length === 0) return result;
		return await new Promise(resolve => {
			writeQueue.on("finish", () => resolve(result));
		});
	}

	async function fetchLegacyDbCollection(
		ref: CollectionReference
	): Promise<Array<IdentifiedDataItem>> {
		let collection: Record<string, AnyData>;

		if (ref.id === "users") {
			// Special handling, fetch all users
			const data: UserIndexDb | null = await userIndexDb(identity);
			if (!data) return [];
			collection = data;
		} else {
			const data: UserDb | null = await dbForUser(ref.uid);
			if (!data) return [];
			collection = data[ref.id] ?? {};
		}

		const entries = Object.entries(collection);
		return entries.map(([key, value]) => ({ ...value, _id: key }));
	}

	function isUser(tbd: AnyData): tbd is User {
		const sansObjectId: AnyData & { _id?: string } = { ...tbd };
		delete sansObjectId["_id"];
		return is(sansObjectId, userSchema);
	}

	function isDataItem(tbd: AnyData): tbd is Identified<DataItem | UserKeys> {
		const sansObjectId: AnyData & { _id?: string } = { ...tbd };
		delete sansObjectId["_id"];
		return is(sansObjectId, dataItemSchema) || is(sansObjectId, userKeysSchema);
	}

	function isNotUser(tbd: AnyData): tbd is Exclude<AnyData, User> {
		return !isUser(tbd);
	}

	function isNotDataitem(tbd: AnyData): tbd is Exclude<AnyData, DataItem | UserKeys> {
		return !isDataItem(tbd);
	}

	// Check if there's anything but attachments to migrate
	const rawLegacyUsers = await fetchLegacyDbCollection(new CollectionReference("SUPER", "users"));
	if (rawLegacyUsers.length === 0) return; // nothing to migrate!

	/* eslint-disable no-console */
	console.info(`Migrating legacy data from ${DB_DIR}`);

	const badLegacyUsers = rawLegacyUsers.filter(isNotUser);
	if (badLegacyUsers.length > 0) {
		console.error(
			`${
				badLegacyUsers.length
			} legacy documents claim to be User documents, but do not fit the expected shape: ${JSON.stringify(
				badLegacyUsers
			)}`
		);
	}

	// Grab all old data, funnel up to PlanetScale, and count the documents moved
	let documentsMoved = 0;
	let documentsNotMoved = badLegacyUsers.length;

	const legacyUsers = rawLegacyUsers.filter(isUser);

	// Get user data, funnel all documents to the new database
	for (const user of legacyUsers) {
		// DataItem & UserKeys
		for (const collectionId of allCollectionIds.filter(id => id !== "users")) {
			const collectionRef = new CollectionReference(user.uid, collectionId);
			const rawLegacyDocs = await fetchLegacyDbCollection(collectionRef);
			const badLegacyDocs = rawLegacyDocs.filter(isNotDataitem);
			if (badLegacyDocs.length > 0) {
				console.error(
					`${
						badLegacyDocs.length
					} legacy documents claim to be DataItem documents, but do not fit the expected shape: ${JSON.stringify(
						badLegacyDocs
					)}`
				);
			}
			documentsNotMoved += badLegacyDocs.length;

			const legacyDocs = rawLegacyDocs
				.filter(isDataItem)
				.map(data => ({ ref: new DocumentReference(collectionRef, data._id), data }));
			if (isNonEmptyArray(legacyDocs)) {
				if (!MIGRATION_DRY_RUN) await upsertDbDocs(legacyDocs);
				documentsMoved += legacyDocs.length;
			}
		}
	}

	console.info(`Finished migrating ${documentsMoved} legacy document(s).`);
	if (documentsNotMoved > 0) {
		console.info(`We could not move ${documentsNotMoved} documents.`);
	} else {
		console.info("You may delete the old database if you'd like.");
	}

	if (MIGRATION_DRY_RUN) {
		console.info('[This was a "dry" run of database migration. No actual data was moved.]');
	}
	/* eslint-enable no-console */
}

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

// The place where the user's encrypted attachments live
function dbFolderForUser(uid: string): string {
	// TODO: Move this to the database
	return joinPath(DB_DIR, "users", uid);
}

interface UserStats {
	totalSpace: number;
	usedSpace: number;
}

export async function statsForUser(uid: string): Promise<UserStats> {
	// TODO: How do we translate this to MySQL?
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
			return (await dataSource.user.findMany()).map(computeRequiredAddtlAuth);
		default:
			throw new UnreachableCaseError(ref.id);
	}
}

export async function findUserWithProperties(query: Partial<User>): Promise<User | null> {
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
	return computeRequiredAddtlAuth(first);
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
			const rawResult = await dataSource.user.findUnique({
				where: { uid: docId },
			});
			if (rawResult === null) return { ref, data: null };

			const result = computeRequiredAddtlAuth(rawResult);
			const data: Identified<User> = {
				_id: result.uid,
				uid: result.uid,
				currentAccountId: result.currentAccountId,
				mfaRecoverySeed: result.mfaRecoverySeed,
				passwordHash: result.passwordHash,
				passwordSalt: result.passwordSalt,
				requiredAddtlAuth: result.requiredAddtlAuth,
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

	await dataSource.$transaction(
		updates.map(update => {
			const collectionId = update.ref.parent.id;
			const docId = update.ref.id;
			const userId = update.ref.uid;
			if ("ciphertext" in update.data) {
				// DataItem
				if (!isDataItemKey(collectionId))
					throw new TypeError(`Collection ID '${collectionId}' was found with DataItem data.`);
				const data: DataItem = update.data;
				const upsert = {
					ciphertext: data.ciphertext,
					objectType: data.objectType,
					cryption: data.cryption ?? "v0",
				};
				return dataSource.dataItem.upsert({
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
			} else if ("dekMaterial" in update.data) {
				// Keys
				const data: UserKeys = update.data;
				const upsert = {
					dekMaterial: data.dekMaterial,
					passSalt: data.passSalt,
					oldDekMaterial: data.oldDekMaterial ?? null,
					oldPassSalt: data.oldPassSalt ?? null,
				};
				return dataSource.userKeys.upsert({
					where: { userId: docId },
					update: upsert,
					create: {
						...upsert,
						user: {
							connect: { uid: userId },
						},
					},
				});
			} else if ("uid" in update.data) {
				// User
				const data: User = update.data;
				const upsert = {
					uid: data.uid,
					currentAccountId: data.currentAccountId,
					passwordHash: data.passwordHash,
					passwordSalt: data.passwordSalt,
					mfaRecoverySeed: data.mfaRecoverySeed ?? null,
					totpSeed: data.totpSeed ?? null,
					requiredAddtlAuth: Array.from(new Set(data.requiredAddtlAuth?.sort(sortStrings) ?? [])),
				};
				return dataSource.user.upsert({
					where: { uid: docId },
					update: upsert,
					create: upsert,
				});
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
		// ...keyRefs.map(ref => dataSource.userKeys.delete({ where: { userId: ref.id } })),
		dataSource.user.deleteMany({ where: { uid: { in: userRefs.map(r => r.id) } } }),
		// ...userRefs.map(ref => dataSource.user.delete({ where: { uid: ref.id } })),
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
