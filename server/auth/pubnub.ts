import type { CollectionReference, DocumentReference, IdentifiedDataItem, User } from "../database";
import { requireEnv } from "../environment";
import { userWithUid } from "../database/reads";
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
	// TODO: This should be a no-op when we're in Express

	const channel = pubNubChannelNameForRef(ref);
	console.debug(`Posting write for channel '${channel}'...`);
	try {
		await pubnubForUser(ref.user, (pubnub, cipherKey) => {
			const message = pubnub.encrypt(
				JSON.stringify({
					message: "Here's your data",
					dataType: "parent" in ref ? "single" : "multiple",
					data: newData,
					timestamp: Date.now(), // so the ciphertext is different each time
				}),
				cipherKey
			);
			return pubnub.publish({
				channel,
				message,
			});
		});
		console.debug(`Posted write for channel '${channel}'`);
	} catch (error) {
		console.error("Failed to post write for channel '%s' due to error", channel, error);
	}
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
export async function newPubNubTokenForUser(user: User): Promise<string> {
	const uid = user.uid;
	return await pubnubForUser(user, pubnub =>
		// Grant permission to the UID to use PubNub for this document
		pubnub.grantToken({
			ttl: 60, // 1 hour
			authorized_uuid: uid,
			patterns: {
				channels: {
					// Only the user's own documents.
					// Channels should be named `[uid]/[channelId]`
					// or `[uid]/[channelId]/[documentId]`
					[`^${uid}/[a-z]+/?[A-Za-z0-9]+$`]: { read: true },
				},
			},
			resources: {
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
 * Creates a {@link PubNub} client instance for the given user. The client
 * is destroyed immediately after the callback resolves or rejects.
 *
 * @param userOrUid The user or the ID of the user whose personal cipher
 * key to use in transmitting messages.
 * @param cb A callback that receives a {@link PubNub} instance for
 * communicating events.
 *
 * @returns The value returned by the callback.
 */
async function pubnubForUser<T>(
	userOrUid: string | User,
	cb: (pubnub: PubNub, cipherKey: string) => T | Promise<T>
): Promise<T> {
	const user = typeof userOrUid === "string" ? await userWithUid(userOrUid) : userOrUid;
	if (!user)
		throw new TypeError(
			`No user exists with uid '${typeof userOrUid === "string" ? userOrUid : "<unknown>"}'`
		);
	const cipherKey = user.pubnubCipherKey;

	// This should be the only PubNub instance for the calling user
	const pubnub = new PubNub({
		secretKey: requireEnv("PUBNUB_SECRET_KEY"), // only used on the server
		publishKey: requireEnv("PUBNUB_PUBLISH_KEY"), // shared by client and server
		subscribeKey: requireEnv("PUBNUB_SUBSCRIBE_KEY"), // shared by client and server
		userId: "server", // clients shouldn't use this UUID
		ssl: true,
	});

	try {
		return await cb(pubnub, cipherKey);
	} finally {
		pubnub.stop();
	}
}
