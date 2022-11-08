import type { CollectionReference, DocumentReference, Query } from "./db.js";
import type { DocumentData } from "./schemas.js";
import type { Infer } from "superstruct";
import type { ListenerParameters } from "pubnub";
import { documentData } from "./schemas.js";
import { AccountableError, UnexpectedResponseError, UnreachableCaseError } from "./errors/index.js";
import { databaseCollection, databaseDocument } from "./apiStruts";
import { doc as docRef, getDoc, getDocs } from "./db.js";
import { isArray } from "../helpers/isArray.js";
import { isString } from "../helpers/isString.js";
import { t } from "../i18n.js";
import { WebSocketCode } from "./websockets/WebSocketCode.js";
import { wsFactory } from "./websockets/websockets.js";
import {
	array,
	assert,
	boolean,
	enums,
	is,
	nonempty,
	nullable,
	optional,
	string,
	StructError,
	type as object,
	union,
} from "superstruct";

export class DocumentSnapshot<T = DocumentData> {
	#data: T | null;

	/**
	 * The `DocumentReference` for the document included in the `DocumentSnapshot`.
	 */
	public readonly ref: DocumentReference<T>;

	constructor(ref: DocumentReference<T>, data: T | null) {
		this.#data = data;
		this.ref = ref;
	}

	/**
	 * Property of the `DocumentSnapshot` that provides the document's ID.
	 */
	get id(): string {
		return this.ref.id;
	}

	/**
	 * Property of the `DocumentSnapshot` that signals whether or not the data
	 * exists. True if the document exists.
	 */
	exists(): this is QueryDocumentSnapshot<T> {
		return this.#data !== null;
	}

	/**
	 * Retrieves all fields in the document as an `Object`. Returns `undefined` if
	 * the document doesn't exist.
	 *
	 * @returns An `Object` containing all fields in the document or `undefined` if
	 * the document doesn't exist.
	 */
	data(): T | undefined {
		return this.#data ?? undefined;
	}
}

export class QueryDocumentSnapshot<T> extends DocumentSnapshot<T> {
	/**
	 * Retrieves all fields in the document as an `Object`.
	 *
	 * @override
	 * @returns An `Object` containing all fields in the document.
	 */
	data(): T {
		const result = super.data();
		if (result === undefined)
			throw new TypeError(
				`Data at ref ${this.ref.parent.id}/${this.ref.id} is meant to exist but does not.`
			);
		return result;
	}
}

export type DocumentChangeType = "added" | "removed" | "modified";

export interface DocumentChange<T> {
	/** The type of change ('added', 'modified', or 'removed'). */
	readonly type: DocumentChangeType;

	/** The document affected by this change. */
	readonly doc: QueryDocumentSnapshot<T>;

	/**
	 * The index of the changed document in the result set immediately prior to
	 * this `DocumentChange` (i.e. supposing that all prior `DocumentChange` objects
	 * have been applied). Is `-1` for 'added' events.
	 */
	readonly oldIndex: number;

	/**
	 * The index of the changed document in the result set immediately after
	 * this `DocumentChange` (i.e. supposing that all prior `DocumentChange`
	 * objects and the current `DocumentChange` object have been applied).
	 * Is -1 for 'removed' events.
	 */
	readonly newIndex: number;
}

export class QuerySnapshot<T> {
	#previousSnapshot: QuerySnapshot<T> | null;

	/** An array of all the documents in the `QuerySnapshot`. */
	public readonly docs: ReadonlyArray<QueryDocumentSnapshot<T>>;

	/**
	 * The query on which you called `get` or `onSnapshot` in order to get this
	 * `QuerySnapshot`.
	 */
	public readonly query: Query<T>;

	/**
	 * @param prev The previous query snapshot, used for generating the result of the `docChanges` method.
	 * @param docs The documents in the snapshot.
	 */
	constructor(prev: QuerySnapshot<T>, docs: Array<QueryDocumentSnapshot<T>>);

	/**
	 * @param query The query used to generate the snapshot.
	 * @param docs The documents in the snapshot.
	 */
	// eslint-disable-next-line @typescript-eslint/unified-signatures
	constructor(query: Query<T>, docs: Array<QueryDocumentSnapshot<T>>);

	/**
	 * @param queryOrPrev The query used to generate the snapshot, or
	 * the previous snapshot in the chain.
	 * @param docs The documents in the snapshot.
	 */
	// eslint-disable-next-line @typescript-eslint/unified-signatures
	constructor(queryOrPrev: Query<T> | QuerySnapshot<T>, docs: Array<QueryDocumentSnapshot<T>>);

	constructor(queryOrPrev: Query<T> | QuerySnapshot<T>, docs: Array<QueryDocumentSnapshot<T>>) {
		if ("type" in queryOrPrev) {
			this.#previousSnapshot = null;
			this.query = queryOrPrev;
		} else {
			this.#previousSnapshot = queryOrPrev;
			this.query = queryOrPrev.query;
		}
		this.docs = docs;
	}

	/** The number of documents in the `QuerySnapshot`. */
	get size(): number {
		return this.docs.length;
	}

	/** True if there are no documents in the `QuerySnapshot`. */
	get empty(): boolean {
		return this.size === 0;
	}

	/**
	 * Enumerates all of the documents in the `QuerySnapshot`.
	 *
	 * @param callback - A callback to be called with a `QueryDocumentSnapshot` for
	 * each document in the snapshot.
	 * @param thisArg - The `this` binding for the callback.
	 */
	forEach(callback: (result: QueryDocumentSnapshot<T>) => void, thisArg?: unknown): void {
		this.docs.forEach(callback, thisArg);
	}

	/**
	 * Returns an array of the documents changes since the last snapshot. If this
	 * is the first snapshot, all documents will be in the list as 'added'
	 * changes.
	 */
	docChanges(): Array<DocumentChange<T>> {
		const prev = this.#previousSnapshot;

		if (!prev) {
			// add all as "added" changes
			return this.docs.map((doc, newIndex) => ({
				type: "added",
				doc,
				oldIndex: -1,
				newIndex,
			}));
		}

		// diff the snapshots from `prev`
		const result: Array<DocumentChange<T>> = this.docs.map((doc, newIndex) => {
			const oldIndex = prev.docs.findIndex(d => d.id === doc.id);
			if (oldIndex === -1) {
				return { type: "added", doc, oldIndex, newIndex };
			}
			// TODO: Handle the case where the data is unchanged
			return { type: "modified", doc, oldIndex, newIndex };
		});

		// add documents that were removed since `prev`
		const removedDocs: Array<DocumentChange<T>> = prev.docs
			.map<DocumentChange<T>>((doc, oldIndex) => {
				const newIndex = this.docs.findIndex(d => d.id === doc.id);
				if (newIndex === -1) {
					return { type: "removed", doc, oldIndex, newIndex };
				}
				// TODO: Handle the case where the data is unchanged
				return { type: "modified", doc, oldIndex, newIndex };
			})
			.filter(change => change.type === "removed");
		result.push(...removedDocs);

		return result;
	}
}

export type Unsubscribe = () => void;

export type DocumentSnapshotCallback<T> = (snapshot: DocumentSnapshot<T>) => void;

export interface DocumentSnapshotObserver<T> {
	next?: DocumentSnapshotCallback<T>;
	error?: (error: Error) => void;
}

export type QuerySnapshotCallback<T> = (snapshot: QuerySnapshot<T>) => void;

export interface QuerySnapshotObserver<T> {
	next?: QuerySnapshotCallback<T>;
	error?: (error: Error) => void;
}

/**
 * Attaches a listener for `DocumentSnapshot` events. You may either pass
 * individual `onNext` and `onError` callbacks or pass a single observer
 * object with `next` and `error` callbacks.
 *
 * @param reference - A reference to the document to listen to.
 * @param observer - A single object containing `next` and `error` callbacks.
 * @returns An unsubscribe function that can be called to cancel
 * the snapshot listener.
 */
export function onSnapshot<T>(
	reference: DocumentReference<T>,
	observer: DocumentSnapshotObserver<T>
): Unsubscribe;

/**
 * Attaches a listener for `DocumentSnapshot` events. You may either pass
 * individual `onNext` and `onError` callbacks or pass a single observer
 * object with `next` and `error` callbacks.
 *
 * @param reference - A reference to the document to listen to.
 * @param onNext - A callback to be called every time a new `DocumentSnapshot`
 * is available.
 * @param onError - A callback to be called if the listen fails or is
 * cancelled. No further callbacks will occur.
 * @returns An unsubscribe function that can be called to cancel
 * the snapshot listener.
 */
export function onSnapshot<T>(
	reference: DocumentReference<T>,
	onNext: DocumentSnapshotCallback<T>,
	onError?: (error: Error) => void
): Unsubscribe;

/**
 * Attaches a listener for `QuerySnapshot` events. You may either pass
 * individual `onNext` and `onError` callbacks or pass a single observer
 * object with `next` and `error` callbacks. The listener can be cancelled by
 * calling the function that is returned when `onSnapshot` is called.
 *
 * @param query - The query to listen to.
 * @param observer - A single object containing `next` and `error` callbacks.
 * @returns An unsubscribe function that can be called to cancel
 * the snapshot listener.
 */
export function onSnapshot<T>(
	query: CollectionReference<T>,
	observer: QuerySnapshotObserver<T>
): Unsubscribe;

/**
 * Attaches a listener for `QuerySnapshot` events. You may either pass
 * individual `onNext` and `onError` callbacks or pass a single observer
 * object with `next` and `error` callbacks. The listener can be cancelled by
 * calling the function that is returned when `onSnapshot` is called.
 *
 * @param query - The query to listen to.
 * @param onNext - A callback to be called every time a new `QuerySnapshot`
 * is available.
 * @param onError - A callback to be called if the listen fails or is
 * cancelled. No further callbacks will occur.
 * @returns An unsubscribe function that can be called to cancel
 * the snapshot listener.
 */
export function onSnapshot<T>(
	query: CollectionReference<T>,
	onNext: QuerySnapshotCallback<T>,
	onError?: (error: Error) => void
): Unsubscribe;

export function onSnapshot<T>(
	queryOrReference: CollectionReference<T> | DocumentReference<T>,
	onNextOrObserver:
		| QuerySnapshotCallback<T>
		| DocumentSnapshotCallback<T>
		| QuerySnapshotObserver<T>
		| DocumentSnapshotObserver<T>,
	onError?: (error: Error) => void
): Unsubscribe {
	const type = queryOrReference.type;
	const db = queryOrReference.db;
	let onNextCallback: QuerySnapshotCallback<T> | DocumentSnapshotCallback<T>;
	let onErrorCallback: (error: Error) => void;

	// Grab callback functions
	if (typeof onNextOrObserver === "object") {
		onNextCallback = onNextOrObserver.next ?? ((): void => undefined);
		onErrorCallback = onNextOrObserver.error ?? onError ?? ((err): void => console.error(err));
	} else {
		onNextCallback = onNextOrObserver;
		onErrorCallback = onError ?? ((err): void => console.error(err));
	}

	if (!db.currentUser) throw new AccountableError("database/unauthenticated");

	let previousSnap: QuerySnapshot<T> | null = null;
	async function handleData({ data, shouldFetch = false }: WatcherData): Promise<void> {
		switch (type) {
			case "collection": {
				const collectionRef = queryOrReference;
				if (shouldFetch) {
					// We may need to fetch the data directly. PubNub has message size limits
					try {
						const allData = await getDocs(queryOrReference);
						const snaps = allData.docs.map<QueryDocumentSnapshot<T>>(snap => {
							return new QueryDocumentSnapshot<T>(snap.ref, snap.data());
						});
						previousSnap = new QuerySnapshot<T>(previousSnap ?? collectionRef, snaps);
						(onNextCallback as QuerySnapshotCallback<T>)(previousSnap);
						return;
					} catch (error) {
						if (error instanceof Error) {
							onErrorCallback(error);
						} else {
							onErrorCallback(new Error(JSON.stringify(error)));
						}
						throw error;
					}
				}

				// No need to fetch, the message has all we need:
				if (!data || !isArray(data))
					throw new UnexpectedResponseError(t("error.ws.data-not-array"));
				const snaps: Array<QueryDocumentSnapshot<T>> = data.map(doc => {
					const id = doc["_id"];
					if (!isString(id)) {
						const err = new TypeError(t("error.server.id-not-string"));
						onErrorCallback(err);
						throw err;
					}
					const ref = docRef(collectionRef.db, collectionRef.id, id);
					return new QueryDocumentSnapshot<T>(ref, doc as T);
				});
				previousSnap = new QuerySnapshot<T>(previousSnap ?? collectionRef, snaps);
				(onNextCallback as QuerySnapshotCallback<T>)(previousSnap);
				return;
			}

			case "document": {
				const ref = queryOrReference;
				if (shouldFetch) {
					// We may need to fetch the data directly. PubNub has message size limits
					try {
						const allData = await getDoc(queryOrReference);
						const snap = new QueryDocumentSnapshot<T>(ref, allData.data() ?? null);
						(onNextCallback as DocumentSnapshotCallback<T>)(snap);
						return;
					} catch (error) {
						if (error instanceof Error) {
							onErrorCallback(error);
						} else {
							onErrorCallback(new Error(JSON.stringify(error)));
						}
						throw error;
					}
				}

				// No need to fetch, the message has all we need:
				if (isArray(data)) throw new UnexpectedResponseError(t("error.ws.data-is-array"));
				const snap = new QueryDocumentSnapshot<T>(ref, data as T | null);
				(onNextCallback as DocumentSnapshotCallback<T>)(snap);
				return;
			}

			default:
				throw new UnreachableCaseError(type);
		}
	}

	const watcherData = object({
		message: nonempty(string()),
		dataType: enums(["single", "multiple"] as const),
		data: nullable(union([array(documentData), documentData])),
		shouldFetch: optional(boolean()),
	});

	const pubnub = db.pubnub;
	if (pubnub) {
		// ** Long polling (PubNub)

		// Vercel doesn't support direct WebSockets. Use PubNub instead
		const channel =
			type === "collection"
				? `${db.currentUser.uid}/${queryOrReference.id}`
				: `${db.currentUser.uid}/${queryOrReference.parent.id}/${queryOrReference.id}`;
		console.debug(`[onSnapshot] Subscribing to channel '${channel}'`);
		const listener: ListenerParameters = {
			message(event) {
				// Only bother with messages for this channel
				if (event.channel !== channel) {
					console.debug(
						`[onSnapshot] Skipping message from channel '${event.channel}'; it doesn't match expected channel '${channel}'`
					);
					return;
				}

				// Make sure the publisher claims to be Accountable's server. (Only holds back kid hackers with our keys)
				const serverPublisher = "server";
				if (event.publisher !== serverPublisher) {
					console.debug(
						`[onSnapshot] Skipping message from publisher '${event.publisher}'; it doesn't match expected publisher '${serverPublisher}'`
					);
					return;
				}

				const cipherKey = db.currentUser?.pubnubCipherKey ?? null;
				if (cipherKey === null) throw new TypeError(t("error.cryption.missing-pek"));

				// Decrypt the message
				let data: unknown;
				try {
					const rawData: unknown = pubnub.decrypt(event.message as string | object, cipherKey);
					if (typeof rawData === "string") {
						console.debug("[onSnapshot] Parsing data from message string");
						data = JSON.parse(rawData) as unknown;
					} else {
						console.debug("[onSnapshot] Taking message as data");
						data = rawData;
					}
				} catch (error) {
					console.error(`[onSnapshot] Failed to decrypt message:`, error);
					return;
				}

				// Ensure the data fits our expectations
				try {
					assert(data, watcherData);
					console.debug(`[onSnapshot] Received snapshot from channel '${channel}'`);
				} catch (error) {
					let message: unknown;
					if (error instanceof StructError) {
						message = `${error.message} at path '${error.path.join(".")}'`;
					} else {
						message = error;
					}
					console.error(`[onSnapshot] Skipping message for channel '%s';`, channel, message);
					return;
				}

				// Process the message data
				void handleData(data);
			},
			status(event) {
				// See https://www.pubnub.com/docs/sdks/javascript/status-events
				switch (event.category) {
					case "PNNetworkUpCategory":
						console.debug(`[onSnapshot] PubNub says the network is up.`);
						break;
					case "PNNetworkDownCategory":
						console.debug(`[onSnapshot] PubNub says the network is down.`);
						break;
					case "PNNetworkIssuesCategory":
						console.debug(`[onSnapshot] PubNub failed to subscribe due to network issues.`);
						break;
					case "PNReconnectedCategory":
						console.debug(`[onSnapshot] PubNub reconnected.`);
						break;
					case "PNConnectedCategory":
						console.debug(
							`[onSnapshot] PubNub connected with new channels: ${JSON.stringify(
								event.subscribedChannels
							)}`
						);
						break;
					case "PNAccessDeniedCategory":
						console.debug(
							`[onSnapshot] PubNub did not permit connecting to channel. Check Access Manager configuration for user tokens.`
						);
						break;
					case "PNMalformedResponseCategory":
						console.debug(`[onSnapshot] PubNub crashed trying to parse JSON.`);
						break;
					case "PNBadRequestCategory":
						console.debug(`[onSnapshot] PubNub request was malformed.`);
						break;
					case "PNDecryptionErrorCategory":
						console.debug(`[onSnapshot] PubNub message decryption failed.`);
						break;
					case "PNTimeoutCategory":
						console.debug(`[onSnapshot] Timed out trying to connect to PubNub.`);
						break;
					default:
						console.debug(
							`[onSnapshot] Received a non-200 response code from PubNub for operation '${
								event.operation
							}' that affects channel(s) ${JSON.stringify(
								event.affectedChannels
							)} and groups ${JSON.stringify(
								event.affectedChannelGroups
							)}. Subbed channels: ${JSON.stringify(event.subscribedChannels)}`
						);
				}
			},
		};

		const unsubscribe = (): void => {
			console.debug(`[onSnapshot] Unsubscribing from channel '${channel}'`);
			pubnub.removeListener(listener);
			pubnub.unsubscribe({ channels: [channel] });
		};

		pubnub.subscribe({ channels: [channel] });
		pubnub.addListener(listener);

		// Run an initial fetch, just like Express used to, since the Vercel back-end doesn't do that for us
		switch (queryOrReference.type) {
			case "collection":
				void handleFetchError(
					getDocs(queryOrReference)
						// eslint-disable-next-line promise/prefer-await-to-then
						.then(snap => {
							console.debug(`[onSnapshot] Received initial snapshot from channel '${channel}'`);
							const data = snap.docs.map(doc => ({ ...doc.data(), _id: doc.id }));
							void handleData({
								data,
								dataType: "multiple",
								message: "Here's your data",
							});
						}),
					unsubscribe,
					onErrorCallback
				);
				break;
			case "document":
				void handleFetchError(
					getDoc(queryOrReference)
						// eslint-disable-next-line promise/prefer-await-to-then
						.then(snap => {
							console.debug(`[onSnapshot] Received initial snapshot from channel '${channel}'`);
							const data = snap.data() ?? null;
							void handleData({
								data: { ...data, _id: snap.id },
								dataType: "single",
								message: "Here's your data",
							});
						}),
					unsubscribe,
					onErrorCallback
				);
				break;
			default:
				throw new UnreachableCaseError(queryOrReference);
		}

		return unsubscribe;
	}

	// ** WebSockets (Express)
	const uid = db.currentUser.uid;
	const baseUrl = new URL(`ws://${db.url.hostname}:${db.url.port}`);
	let url: URL;

	switch (type) {
		case "collection":
			url = new URL(databaseCollection(uid, queryOrReference.id), baseUrl);
			break;
		case "document":
			url = new URL(
				databaseDocument(uid, queryOrReference.parent.id, queryOrReference.id),
				baseUrl
			);
			break;
	}

	type WatcherData = Infer<typeof watcherData>;

	const { onClose, onMessage, send } = wsFactory(url, {
		stop(tbd): tbd is "STOP" {
			return tbd === "STOP";
		},
		data(tbd): tbd is WatcherData {
			return is(tbd, watcherData);
		},
	});

	onMessage("data", data => void handleData(data));

	onClose((code, _reason) => {
		console.debug(
			t("error.ws.closed-with-code-reason", {
				values: { code, reason: _reason || t("error.ws.no-reason-given") },
			})
		);

		const WS_NORMAL = WebSocketCode.NORMAL;
		const WS_GOING_AWAY = WebSocketCode.WENT_AWAY;
		const WS_UNKNOWN = WebSocketCode.__UNKNOWN_STATE;

		// Connection closed. Find out why
		if (code !== WS_NORMAL) {
			let reason: string | null = null;

			if (_reason?.trim()) {
				reason = _reason;
			} else if (!navigator.onLine) {
				// Offline status could cause a 1006, so we handle this case first
				// TODO: Show some UI or smth to indicate online status, and add a way to manually reconnect.
				reason = t("error.ws.internet-gone");
			} else if (code === WS_UNKNOWN) {
				reason = t("error.ws.server-closed-without-reason");
			} else if (code === WS_GOING_AWAY) {
				reason = t("error.ws.endpoints-closing-down");
			}

			if (reason !== null && reason) {
				onErrorCallback(
					new Error(t("error.ws.closed-with-code-reason", { values: { code, reason } }))
				);
			} else {
				onErrorCallback(new Error(t("error.ws.closed-with-code", { values: { code } })));
			}
		}
	});

	return (): void => {
		send("stop", "STOP");
	};
}

async function handleFetchError(
	p: Promise<unknown>,
	unsubscribe: Unsubscribe,
	onErrorCallback: (err: Error) => void
): Promise<void> {
	try {
		await p;
	} catch (error) {
		unsubscribe();
		if (error instanceof Error) {
			onErrorCallback(error);
		} else {
			onErrorCallback(new Error(JSON.stringify(error)));
		}
	}
}
