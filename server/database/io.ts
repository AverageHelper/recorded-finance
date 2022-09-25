import type { CollectionReference, DocumentReference } from "./references.js";
import type {
	CollectionID,
	DataItem,
	DataItemKey,
	DataOf,
	Identified,
	IdentifiedDataItem,
	User,
	UserKeys,
} from "./schemas.js";
import { assertSchema, user as userSchema } from "./schemas.js";
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

export async function fetchDbCollection<ID extends CollectionID>(
	ref: CollectionReference<ID>
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
						id: true,
					},
				})
			).map(v => ({ ...v, _id: v.id }));
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
				hasEvery: query.requiredAddtlAuth,
			},
		},
	});
}

/** A view of database data. */
interface Snapshot<ID extends CollectionID = CollectionID> {
	/** The database reference. */
	ref: DocumentReference<ID>;

	/** The stored data for the reference. */
	data: Identified<DataOf<ID>> | null;
}

function isDataItemKey(id: CollectionID): id is DataItemKey {
	switch (id) {
		case "accounts":
		case "attachments":
		case "locations":
		case "tags":
		case "transactions":
			return true;

		case "keys":
		case "users":
			return false;
		default:
			throw new UnreachableCaseError(id);
	}
}

/**
 * Fetches the referenced data item from the database.
 *
 * @param ref A document reference.
 * @returns a view of database data.
 */
export async function fetchDbDoc(ref: DocumentReference): Promise<Snapshot> {
	const collectionId = ref.parent.id;
	const id = ref.id;
	if (isDataItemKey(collectionId)) {
		const result = await dataSource.dataItem.findFirst({ where: { id, collectionId } });
		if (result === null) return { ref, data: null };

		const data: Identified<DataItem> = {
			_id: result.id,
			objectType: result.objectType,
			ciphertext: result.ciphertext,
			cryption: result.cryption ?? "v0",
		};
		return { ref, data };
	}
	switch (collectionId) {
		case "keys": {
			const result = await dataSource.userKeys.findUnique({ where: { userId: id } });
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
			const result = await dataSource.user.findUnique({ where: { uid: id } });
			if (result === null) return { ref, data: null };

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
export async function fetchDbDocs<ID extends CollectionID>(
	refs: NonEmptyArray<DocumentReference<ID>>
): Promise<NonEmptyArray<Snapshot<ID>>> {
	// Assert same UID on all refs
	const uid = refs[0].uid;
	if (!refs.every(u => u.uid === uid))
		throw new TypeError(`Not every UID matches the first: ${uid}`);

	// fetch the data
	return (await Promise.all(refs.map(fetchDbDoc))) as NonEmptyArray<Snapshot<ID>>;
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

export interface DocUpdate<ID extends CollectionID = CollectionID> {
	ref: DocumentReference<ID>;
	data: DataOf<ID>;
}

export async function upsertDbDocs(updates: NonEmptyArray<DocUpdate>): Promise<void> {
	// Assert same UID on all refs
	const uid = updates[0].ref.uid;
	if (!updates.every(u => u.ref.uid === uid))
		throw new TypeError(`Not every UID matches the first: ${uid}`);

	await Promise.all(
		updates.map(async update => {
			const collectionId = update.ref.parent.id;
			const id = update.ref.id;
			switch (collectionId) {
				case "accounts":
				case "attachments":
				case "locations":
				case "tags":
				case "transactions": {
					const data = (update as DocUpdate<DataItemKey>).data;
					await dataSource.dataItem.upsert({
						where: { id },
						update: data,
						create: { ...data, collectionId, userId: uid },
					});
					return;
				}
				case "keys": {
					const data = (update as DocUpdate<"keys">).data;
					await dataSource.userKeys.upsert({
						where: { userId: id },
						update: data,
						create: data,
					});
					return;
				}
				case "users": {
					const data = (update as DocUpdate<"users">).data;
					await dataSource.user.upsert({
						where: { uid: id },
						update: data,
						create: data,
					});
					return;
				}
				default:
					throw new UnreachableCaseError(collectionId);
			}
		})
	);
}

export async function deleteDbDocs<ID extends CollectionID>(
	refs: NonEmptyArray<DocumentReference<ID>>
): Promise<void> {
	// Assert same UID on all refs
	const uid = refs[0].uid;
	if (!refs.every(u => u.uid === uid))
		throw new TypeError(`Not every UID matches the first: ${uid}`);

	await Promise.all(
		refs.map(async ref => {
			const collectionId = ref.parent.id;
			const id = ref.id;
			switch (collectionId) {
				case "accounts":
				case "attachments":
				case "locations":
				case "tags":
				case "transactions":
					await dataSource.dataItem.delete({ where: { id } });
					return;
				case "keys":
					await dataSource.userKeys.delete({ where: { userId: id } });
					return;
				case "users":
					await dataSource.user.delete({ where: { uid: id } });
					return;
				default:
					throw new UnreachableCaseError(collectionId);
			}
		})
	);
}

export async function deleteDbDoc<ID extends CollectionID>(
	ref: DocumentReference<ID>
): Promise<void> {
	await deleteDbDocs([ref]);
}

export async function deleteDbCollection<ID extends CollectionID>(
	ref: CollectionReference<ID>
): Promise<void> {
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
