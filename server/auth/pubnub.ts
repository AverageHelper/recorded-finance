import type { CollectionReference, DocumentReference, IdentifiedDataItem } from "../database";
import { randomBytes } from "node:crypto";
import { requireEnv } from "../environment";
import PubNub from "pubnub";

/**
 * Publishes a write event for the given collection to PubNub.
 *
 * @param ref The collection that was written to.
 * @param newData The new data in the collection.
 */
export async function publishWriteForRef(
	ref: CollectionReference,
	newData: Array<IdentifiedDataItem>
): Promise<void>;

/**
 * Publishes a write event for the given document to PubNub.
 *
 * @param ref The document that was written to.
 * @param newData The new data in the document, or `null` if the document was deleted.
 */
export async function publishWriteForRef(
	ref: DocumentReference,
	newData: IdentifiedDataItem | null
): Promise<void>;

export async function publishWriteForRef(
	ref: CollectionReference | DocumentReference,
	newData: Array<IdentifiedDataItem> | IdentifiedDataItem | null
): Promise<void> {
	const channel = pubNubChannelNameForRef(ref);
	await pubnubForUser(ref.uid, pubnub =>
		pubnub.publish({
			channel,
			message: newData,
		})
	);
}

/**
 * Returns a properly-formatted channel name string for the given database reference.
 */
function pubNubChannelNameForRef(ref: CollectionReference | DocumentReference): string {
	if ("parent" in ref) {
		// DocumentReference
		return `${ref.uid}/${ref.parent.id}/${ref.id}`;
	}

	// CollectionReference
	return `${ref.uid}/${ref.id}`;
}

/**
 * Generates a limited-use PubNub access token for a given user to receive
 * notifications about write events to their data. This token should only
 * last as long as the session does, and should be revoked when the
 * session ends.
 */
export async function newPubNubTokenForUser(uid: string): Promise<string> {
	return await pubnubForUser(uid, pubnub =>
		// Grant permission to the UID to use PubNub for this document
		pubnub.grantToken({
			ttl: 60, // 1 hour
			authorized_uuid: uid,
			resources: {
				channels: {
					// Only the user's own documents.
					// Channels should be named `[uid]/[channelId]`
					// or `[uid]/[channelId]/[documentId]`
					[`^${uid}/[A-Za-z0-9]+/?[A-Za-z0-9]+$`]: { read: true },
				},
				uuids: {
					// Only the user's own metadata
					[uid]: { read: true },
				},
			},
		})
	);
}

/**
 * Revokes the given PubNub access token. Once the token has been revoked,
 * it cannot be re-enabled or re-used to establish future connections.
 */
export async function revokePubNubToken(token: string, uid: string): Promise<void> {
	await pubnubForUser(uid, async pubnub => {
		try {
			pubnub.parseToken(token);
		} catch {
			// The token isn't valid, so no point in revoking it
			return;
		}
		await pubnub.revokeToken(token);
	});
}

/**
 * Generates a new 32-character key for PubNub's AES 256 message-level encryption.
 */
export async function newPubNubCipherKey(): Promise<string> {
	return await Promise.resolve(randomBytes(16).toString("hex"));
}

/**
 * Creates a {@link PubNub} client instance for the given user. The client
 * is destroyed immediately after the callback resolves or rejects.
 *
 * @param uid The ID of the user whose personal cipher key to use in transmitting messages.
 * @param cb A callback that receives a {@link PubNub} instance for communicating events.
 *
 * @returns The value returned by the callback.
 */
async function pubnubForUser<T>(uid: string, cb: (pubnub: PubNub) => T | Promise<T>): Promise<T> {
	const { userWithUid } = await import("../database/io"); // FIXME: This import shouldn't be circular
	const user = await userWithUid(uid);
	if (!user) throw new TypeError(`No user exists with uid '${uid}'`);
	const cipherKey = user.pubnubCipherKey;

	// This should be the only PubNub instance for the calling user
	const pubnub = new PubNub({
		secretKey: requireEnv("PUBNUB_SECRET_KEY"), // only used on the server
		publishKey: requireEnv("PUBNUB_PUBLISH_KEY"), // only used on the server
		subscribeKey: requireEnv("PUBNUB_SUBSCRIBE_KEY"), // shared by client and server
		cipherKey, // shared by client and server, only for this user
		uuid: "server", // clients shouldn't use this UUID
		ssl: true,
	});

	try {
		return await cb(pubnub);
	} finally {
		pubnub.stop();
	}
}
