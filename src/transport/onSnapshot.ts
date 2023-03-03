import type { CollectionReference, DocumentReference } from "./db.js";
import type { DocumentSnapshot } from "./snapshots/index.js";
import type { Infer } from "superstruct";
import type { ListenerParameters } from "pubnub";
import { documentData } from "./schemas.js";
import { databaseCollection, databaseDocument } from "./apiStruts";
import { doc as docRef, getDoc, getDocs } from "./db.js";
import { isArray } from "../helpers/isArray.js";
import { isString } from "../helpers/isString.js";
import { logger } from "../logger.js";
import { PlatformError, UnexpectedResponseError, UnreachableCaseError } from "./errors/index.js";
import { QueryDocumentSnapshot, QuerySnapshot } from "./snapshots/index.js";
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

export type Unsubscribe = () => void;

export type DocumentSnapshotCallback<T extends NonNullable<unknown>> = (
	snapshot: DocumentSnapshot<T>
) => void;

export interface DocumentSnapshotObserver<T extends NonNullable<unknown>> {
	next?: DocumentSnapshotCallback<T>;
	error?: (error: Error) => void;
}

export type QuerySnapshotCallback<T extends NonNullable<unknown>> = (
	snapshot: QuerySnapshot<T>
) => void;

export interface QuerySnapshotObserver<T extends NonNullable<unknown>> {
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
export function onSnapshot<T extends NonNullable<unknown>>(
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
export function onSnapshot<T extends NonNullable<unknown>>(
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
export function onSnapshot<T extends NonNullable<unknown>>(
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
export function onSnapshot<T extends NonNullable<unknown>>(
	query: CollectionReference<T>,
	onNext: QuerySnapshotCallback<T>,
	onError?: (error: Error) => void
): Unsubscribe;

export function onSnapshot<T extends NonNullable<unknown>>(
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
		onErrorCallback = onNextOrObserver.error ?? onError ?? ((err): void => logger.error(err));
	} else {
		onNextCallback = onNextOrObserver;
		onErrorCallback = onError ?? ((err): void => logger.error(err));
	}

	if (!db.currentUser) throw new PlatformError("database/unauthenticated");

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
				const snaps: Array<QueryDocumentSnapshot<T>> = data.map(_doc => {
					const doc = { ..._doc }; // shallow copy
					const id = doc["_id"];
					delete doc["_id"];
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
						if (allData.exists()) {
							const snap = new QueryDocumentSnapshot(ref, allData.data());
							(onNextCallback as DocumentSnapshotCallback<T>)(snap);
						}
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
				if (data !== null) {
					const snap = new QueryDocumentSnapshot<T>(ref, data as T);
					(onNextCallback as DocumentSnapshotCallback<T>)(snap);
				}
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
		logger.debug(`[onSnapshot] Subscribing to channel '${channel}'`);
		const listener: ListenerParameters = {
			message(event) {
				// Only bother with messages for this channel
				if (event.channel !== channel) {
					logger.debug(
						`[onSnapshot] Skipping message from channel '${event.channel}'; it doesn't match expected channel '${channel}'`
					);
					return;
				}

				// Make sure the publisher claims to be our server. (Only holds back kid hackers with our keys)
				const serverPublisher = "server";
				if (event.publisher !== serverPublisher) {
					logger.debug(
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
					if (rawData === null) {
						throw new TypeError(t("error.cryption.empty-result"));
					} else if (typeof rawData === "string") {
						logger.debug("[onSnapshot] Parsing data from message string");
						data = JSON.parse(rawData) as unknown;
					} else {
						logger.debug("[onSnapshot] Taking message as data");
						data = rawData;
					}
				} catch (error) {
					logger.error(`[onSnapshot] Failed to decrypt message:`, error);
					if (error instanceof Error) {
						onErrorCallback(error);
					} else if (typeof error === "string") {
						onErrorCallback(new Error(error));
					} else {
						onErrorCallback(new Error(JSON.stringify(error)));
					}
					return;
				}

				// Ensure the data fits our expectations
				try {
					assert(data, watcherData);
					logger.debug(`[onSnapshot] Received snapshot from channel '${channel}'`);
				} catch (error) {
					let message: unknown;
					if (error instanceof StructError) {
						message = `${error.message} at path '${error.path.join(".")}'`;
					} else {
						message = error;
					}
					logger.error(`[onSnapshot] Skipping message for channel '%s';`, channel, message);
					return;
				}

				// Process the message data
				void handleData(data);
			},
			status(event) {
				// See https://www.pubnub.com/docs/sdks/javascript/status-events
				switch (event.category) {
					case "PNNetworkUpCategory":
						logger.debug(`[onSnapshot] PubNub says the network is up.`);
						break;
					case "PNNetworkDownCategory":
						logger.debug(`[onSnapshot] PubNub says the network is down.`);
						break;
					case "PNNetworkIssuesCategory":
						logger.debug(`[onSnapshot] PubNub failed to subscribe due to network issues.`);
						break;
					case "PNReconnectedCategory":
						logger.debug(`[onSnapshot] PubNub reconnected.`);
						break;
					case "PNConnectedCategory":
						logger.debug(
							`[onSnapshot] PubNub connected with new channels: ${JSON.stringify(
								event.subscribedChannels
							)}`
						);
						break;
					case "PNAccessDeniedCategory":
						logger.debug(
							`[onSnapshot] PubNub did not permit connecting to channel. Check Access Manager configuration for user tokens.`
						);
						break;
					case "PNMalformedResponseCategory":
						logger.debug(`[onSnapshot] PubNub crashed trying to parse JSON.`);
						break;
					case "PNBadRequestCategory":
						logger.debug(`[onSnapshot] PubNub request was malformed.`);
						break;
					case "PNDecryptionErrorCategory":
						logger.debug(`[onSnapshot] PubNub message decryption failed.`);
						break;
					case "PNTimeoutCategory":
						logger.debug(`[onSnapshot] Timed out trying to connect to PubNub.`);
						break;
					default:
						logger.debug(
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
			logger.debug(`[onSnapshot] Unsubscribing from channel '${channel}'`);
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
							logger.debug(`[onSnapshot] Received initial snapshot from channel '${channel}'`);
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
							logger.debug(`[onSnapshot] Received initial snapshot from channel '${channel}'`);
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
	const baseUrl = new URL(`wss://${db.url.hostname}:${db.url.port}`);
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
		logger.debug(
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
