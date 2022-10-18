import type { DocumentData, DocumentWriteBatch, PrimitiveRecord } from "./schemas.js";
import type { EPackage, HashStore } from "./cryption.js";
import type { Unsubscribe } from "./onSnapshot.js";
import type { User } from "./auth.js";
import type { ValueIteratorTypeGuard } from "lodash";
import { AccountableError } from "./errors/index.js";
import { decrypt } from "./cryption.js";
import { forgetJobQueue, useJobQueue } from "@averagehelper/job-queue";
import { isArray } from "../helpers/isArray";
import { isPrimitive } from "./schemas.js";
import { isString } from "../helpers/isString";
import { t } from "../i18n";
import { v4 as uuid } from "uuid";
import PubNub from "pubnub";
import {
	databaseBatchWrite,
	databaseCollection,
	databaseDocument,
	deleteAt,
	getFrom,
	postTo,
	urlForApi,
} from "./api-types/index.js";
import {
	DocumentSnapshot,
	onSnapshot,
	QueryDocumentSnapshot,
	QuerySnapshot,
} from "./onSnapshot.js";

export class AccountableDB {
	#currentUser: User | null;
	#lastKnownUserStats: UserStats | null;
	#pubnub: PubNub | null;
	public readonly url: Readonly<URL>;

	constructor(url: string) {
		this.#currentUser = null;
		this.#lastKnownUserStats = null;
		this.#pubnub = null;
		this.url = new URL(url);
	}

	get currentUser(): User | null {
		return this.#currentUser;
	}

	get lastKnownUserStats(): UserStats | null {
		return this.#lastKnownUserStats;
	}

	get pubnub(): PubNub | null {
		return this.#pubnub;
	}

	setUser(user: User, pubnubToken: string): void {
		this.#currentUser = user;

		const subscribeKey = import.meta.env.VITE_PUBNUB_SUBSCRIBE_KEY;
		const publishKey = import.meta.env.VITE_PUBNUB_PUBLISH_KEY;
		if (subscribeKey !== undefined && subscribeKey) {
			if (user.pubnubCipherKey === null) throw new TypeError(t("error.cryption.missing-pek"));

			this.#pubnub?.unsubscribeAll();
			this.#pubnub?.stop();
			// This should be the only PubNub instance for this database
			this.#pubnub = new PubNub({
				subscribeKey,
				publishKey,
				// cipherKey: user.pubnubCipherKey,
				uuid: user.uid,
				ssl: true,
				restore: false, // cache subscribed channels, and re-subscribe in the event of network failure
				logVerbosity: true,
			});
			this.#pubnub.setToken(pubnubToken);
		}
	}

	setUserStats(stats: UserStats | null): void {
		if (stats === null) {
			this.#lastKnownUserStats = null;
		} else {
			this.#lastKnownUserStats = {
				usedSpace: stats.usedSpace,
				totalSpace: stats.totalSpace,
			};
		}
	}

	clearUser(): void {
		this.#pubnub?.unsubscribeAll();
		this.#pubnub?.stop();
		this.#pubnub = null; // listeners go away too
		this.#currentUser = null;
		this.setUserStats(null);
	}

	toString(): string {
		return JSON.stringify({
			url: this.url,
			currentUser: this.#currentUser ? "<signed in>" : null,
		});
	}
}

interface UserStats {
	readonly totalSpace: number;
	readonly usedSpace: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface Query<T = DocumentData> {
	/** The type of this database reference. */
	readonly type: "query" | "collection";

	/**
	 * The {@link AccountableDB} instance for the Accountable database (useful for performing
	 * transactions, etc.).
	 */
	readonly db: AccountableDB;
}

export type CollectionID =
	| "accounts"
	| "attachments"
	| "keys"
	| "locations"
	| "tags"
	| "transactions"
	| "users";

export interface CollectionReference<T = DocumentData> extends Query<T> {
	/** The type of this Accountable reference. */
	readonly type: "collection";

	/** The collection's identifier. */
	readonly id: Readonly<CollectionID>;
}

/**
 * Creates a `CollectionReference` instance that refers to the collection at
 * the specified absolute path.
 *
 * @param db - A reference to the root `AccountableDB` instance.
 * @param id - A collection ID.
 * @returns A new {@link CollectionReference} instance.
 */
export function collection<T = DocumentData>(
	db: AccountableDB,
	id: CollectionID
): CollectionReference<T> {
	return { db, id, type: "collection" };
}

export interface DocumentReference<T = DocumentData> {
	/** The type of this database reference. */
	readonly type: "document";

	/**
	 * The collection this `DocumentReference` belongs to.
	 */
	readonly parent: CollectionReference<T>;

	/**
	 * The document's identifier within its collection.
	 */
	readonly id: string;

	/**
	 * The {@link AccountableDB} instance the document is in.
	 * This is useful for performing transactions, for example.
	 */
	readonly db: AccountableDB;
}

/**
 * Creates a `DocumentReference` instance that refers to the document at the
 * specified absolute path.
 *
 * @param collection - A collection to use as the parent of the document.
 * @returns A new {@link DocumentReference} instance.
 */
export function doc<T = DocumentData>(collection: CollectionReference<T>): DocumentReference<T>;

/**
 * Creates a `DocumentReference` instance that refers to the document at the
 * specified absolute path.
 *
 * @param db - A reference to the root `AccountableDB` instance.
 * @param collectionId - A collection ID.
 * @param id - A document ID.
 * @returns A new {@link DocumentReference} instance.
 */
export function doc<T = DocumentData>(
	db: AccountableDB,
	collectionId: CollectionID,
	id: string
): DocumentReference<T>;

export function doc<T = DocumentData>(
	dbOrCollection: AccountableDB | CollectionReference<T>,
	collectionId?: CollectionID,
	id?: string
): DocumentReference<T> {
	if ("url" in dbOrCollection) {
		if (!collectionId || id === undefined) {
			throw new TypeError(t("error.sanity.missing-constructor-property"));
		}
		if (!id) throw new TypeError(t("error.sanity.empty-param", { values: { name: "ID" } }));
		const parent = collection<T>(dbOrCollection, collectionId);
		return { id, parent, db: dbOrCollection, type: "document" };
	}
	const newId = uuid().replace(/-/gu, ""); // remove hyphens
	return {
		id: newId,
		parent: dbOrCollection,
		db: dbOrCollection.db,
		type: "document",
	};
}

interface PutOperation {
	type: "set";
	ref: DocumentReference;
	primitiveData: DocumentData;
}

interface DeleteOperation {
	type: "delete";
	ref: DocumentReference;
}

type WriteOperation = PutOperation | DeleteOperation;

export class WriteBatch {
	#db: AccountableDB | null;
	#operations: Array<WriteOperation>;

	constructor() {
		this.#db = null;
		this.#operations = [];
	}

	#pushOperation(op: WriteOperation): void {
		// Ensure limit
		const OP_LIMIT = 500;
		if (this.#operations.length >= OP_LIMIT) {
			throw new RangeError(t("error.db.batch.op-limit", { values: { limit: OP_LIMIT } }));
		}

		// Same db
		if (!this.#db) {
			this.#db = op.ref.db;
		} else if (op.ref.db !== this.#db) {
			throw new EvalError(t("error.db.batch.one-db"));
		}

		// Push operation
		this.#operations.push(op);
	}

	set<T extends object>(ref: DocumentReference<T>, data: T): void {
		const primitiveData: DocumentData = {};
		Object.entries(data).forEach(([key, value]) => {
			if (!isPrimitive(value)) return;
			primitiveData[key] = value;
		});
		this.#pushOperation({ type: "set", ref, primitiveData });
	}

	delete<T = DocumentData>(ref: DocumentReference<T>): void {
		this.#pushOperation({ type: "delete", ref });
	}

	async commit(): Promise<void> {
		if (!this.#db) return; // nothing to commit

		// Build and commit the list of operations in one go
		const currentUser = this.#db.currentUser;
		if (!currentUser) throw new AccountableError("database/unauthenticated");

		const uid = currentUser.uid;
		const batch = urlForApi(this.#db, databaseBatchWrite(uid));

		const data: Array<DocumentWriteBatch> = [];

		this.#operations.forEach(op => {
			const collectionId = op.ref.parent.id;
			const documentId = op.ref.id;
			const ref = { collectionId, documentId };

			switch (op.type) {
				case "delete":
					data.push({ type: "delete", ref });
					break;
				case "set":
					data.push({ type: "set", ref, data: op.primitiveData });
					break;
			}
		});

		await postTo(batch, data);
	}

	toString(): string {
		return JSON.stringify({
			operations: `<${this.#operations.length} operations>`,
		});
	}
}

export function writeBatch(): WriteBatch {
	return new WriteBatch();
}

export let db: AccountableDB;

export function isWrapperInstantiated(): boolean {
	return db !== undefined;
}

/**
 * Bootstrap our app using either environment variables or provided params.
 *
 * @param url The server URL to use instead of environment variables
 * to instantiate the backend connection.
 */
export function bootstrap(url?: string): AccountableDB {
	if (isWrapperInstantiated()) {
		throw new TypeError("db has already been instantiated");
	}

	// VITE_ env variables get type definitions in env.d.ts
	let serverUrl = url ?? import.meta.env.VITE_ACCOUNTABLE_SERVER_URL;

	if (serverUrl === undefined || !serverUrl) {
		serverUrl = `https://${window.location.hostname}/api/`;
	}

	db = new AccountableDB(serverUrl);
	return db;
}

/**
 * Gets statistics about the space the user's data occupies on the server.
 */
export async function getUserStats(db: AccountableDB): Promise<UserStats> {
	// This might be on the server too, but since Accountable gets this back with every write, we keep a copy here and use an async function to retrieve it.
	// TODO: Add an endpoint for this
	const stats = db.lastKnownUserStats;
	return await Promise.resolve({
		usedSpace: stats?.usedSpace ?? Number.MAX_SAFE_INTEGER,
		totalSpace: stats?.totalSpace ?? Number.MAX_SAFE_INTEGER,
	});
}

/**
 * Reads the document referred to by this `DocumentReference`.
 *
 * @param reference - The reference of the document to fetch.
 * @returns A Promise resolved with a `DocumentSnapshot` containing the
 * current document contents.
 */
export async function getDoc<D, T extends PrimitiveRecord<D>>(
	reference: DocumentReference<T>
): Promise<DocumentSnapshot<T>> {
	const currentUser = reference.db.currentUser;
	if (!currentUser) throw new AccountableError("database/unauthenticated");

	const uid = currentUser.uid;
	const collection = reference.parent.id;
	const doc = reference.id;

	const docPath = urlForApi(reference.db, databaseDocument(uid, collection, doc));
	const { data } = await getFrom(docPath);

	if (data === undefined) throw new TypeError(t("error.server.no-data"));
	if (isArray(data)) throw new TypeError(t("error.server.too-many-documents"));

	return new DocumentSnapshot<T>(reference, data as T | null);
}

/**
 * Writes to the document referred to by this `DocumentReference`. If the
 * document does not yet exist, it will be created.
 *
 * @param reference - A reference to the document to write.
 * @param data - A map of the fields and values for the document.
 * @returns A `Promise` resolved once the data has been successfully written
 * to the backend (note that it won't resolve while you're offline).
 */
export async function setDoc<D, T extends PrimitiveRecord<D>>(
	reference: DocumentReference<T>,
	data: T
): Promise<void> {
	const currentUser = reference.db.currentUser;
	if (!currentUser) throw new AccountableError("database/unauthenticated");

	const uid = currentUser.uid;
	const collection = reference.parent.id;
	const doc = reference.id;
	const docPath = urlForApi(reference.db, databaseDocument(uid, collection, doc));

	const { usedSpace, totalSpace } = await postTo(docPath, data);
	if (usedSpace !== undefined && totalSpace !== undefined) {
		reference.db.setUserStats({ usedSpace, totalSpace });
	}
}

/**
 * Deletes the document referred to by the specified `DocumentReference`.
 *
 * @param reference - A reference to the document to delete.
 * @returns A Promise resolved once the document has been successfully
 * deleted from the backend (note that it won't resolve while you're offline).
 */
export async function deleteDoc(reference: DocumentReference): Promise<void> {
	const currentUser = reference.db.currentUser;
	if (!currentUser) throw new AccountableError("database/unauthenticated");

	const uid = currentUser.uid;
	const collection = reference.parent.id;
	const doc = reference.id;
	const docPath = urlForApi(reference.db, databaseDocument(uid, collection, doc));

	const { usedSpace, totalSpace } = await deleteAt(docPath);
	if (usedSpace !== undefined && totalSpace !== undefined) {
		reference.db.setUserStats({ usedSpace, totalSpace });
	}
}

/**
 * Executes the query and returns the results as a `QuerySnapshot`.
 *
 * @returns A `Promise` that will be resolved with the results of the query.
 */
export async function getDocs<T>(query: CollectionReference<T>): Promise<QuerySnapshot<T>> {
	const currentUser = query.db.currentUser;
	if (!currentUser) throw new AccountableError("database/unauthenticated");

	const uid = currentUser.uid;
	const collection = query.id;
	const collPath = urlForApi(query.db, databaseCollection(uid, collection));

	const { data } = await getFrom(collPath);
	if (data === undefined) throw new TypeError(t("error.server.no-data"));
	if (data === null || !isArray(data)) throw new TypeError(t("error.server.too-few-documents"));

	return new QuerySnapshot(
		query,
		data.map(data => {
			const id = data["_id"];
			delete data["_id"];
			if (!isString(id)) throw new TypeError(t("error.server.id-not-string"));

			return new QueryDocumentSnapshot(doc(query.db, query.id, id), data as T);
		})
	);
}

export function watchAllRecords<T = DocumentData>(
	collection: CollectionReference<T>,
	onSnap: (snap: QuerySnapshot<T>) => void | Promise<void>,
	onError?: ((error: Error) => void) | undefined
): Unsubscribe {
	const queueId = `watchAllRecords-${collection.id}`;
	const queue = useJobQueue<QuerySnapshot<T>>(queueId);
	queue.process(onSnap);
	const unsubscribe = onSnapshot<T>(collection, snap => queue.createJob(snap), onError);

	return (): void => {
		unsubscribe();
		forgetJobQueue(queueId);
	};
}

export function watchRecord<T = DocumentData>(
	doc: DocumentReference<T>,
	onSnap: (snap: DocumentSnapshot<T>) => void | Promise<void>,
	onError?: ((error: Error) => void) | undefined
): Unsubscribe {
	const queueId = `watchRecord-${doc.parent.id}-${doc.id}`;
	const queue = useJobQueue<DocumentSnapshot<T>>(queueId);
	queue.process(onSnap);
	const unsubscribe = onSnapshot(doc, snap => queue.createJob(snap), onError);

	return (): void => {
		unsubscribe();
		forgetJobQueue(queueId);
	};
}

export function recordFromSnapshot<G, T extends string>(
	doc: QueryDocumentSnapshot<EPackage<T>>,
	dek: HashStore,
	typeGuard: ValueIteratorTypeGuard<unknown, G>
): { id: string; record: G } {
	const pkg = doc.data();
	const record = decrypt(pkg, dek);
	if (!typeGuard(record)) {
		console.debug(
			t("error.db.record-does-not-match-guard", { values: { guard: typeGuard.name } }),
			record
		);
		throw new TypeError(t("error.db.could-not-parse-document", { values: { id: doc.id } }));
	}
	return { id: doc.id, record };
}

export type { DocumentSnapshot, QueryDocumentSnapshot, QuerySnapshot, Unsubscribe };
