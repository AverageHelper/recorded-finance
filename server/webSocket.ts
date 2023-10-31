import type { Unsubscribe } from "./database/read";
import type { User } from "./database/schemas";
import { allCollectionIds, identifiedDataItem, nonemptyString } from "./database/schemas";
import { array, assert, enums, literal, nullable, object, union } from "superstruct";
import { CollectionReference, DocumentReference } from "./database/references";
import { logger } from "./logger";
import { requireAuth } from "./auth/requireAuth";
import { watchUpdatesToCollection, watchUpdatesToDocument } from "./database/read";
import { WebSocketCode } from "./networking/WebSocketCode";
import { ws } from "./networking/websockets";

type WebSocketPaths =
	| "/users/:uid/:collectionId/.websocket"
	| "/users/:uid/:collectionId/:documentId/.websocket";

export const webSocket: APIRequestHandler<WebSocketPaths> = ws(
	// interactions
	{
		stop: literal("STOP"),

		data: object({
			message: nonemptyString,
			dataType: enums(["single", "multiple"] as const),
			data: nullable(union([array(identifiedDataItem), identifiedDataItem])),
		}),
	},

	// start
	async (context, params) => {
		const { context: c, onClose, onMessage, send, close } = context;
		const { collectionId, documentId = null } = params;

		assert(collectionId, enums(allCollectionIds));
		assert(documentId, nullable(nonemptyString));

		let user: User;

		try {
			logger.debug("[WebSocket] Checking auth state...");
			user = await requireAuth(c); // FIXME: Apparently this is suboptimal. Use the `Sec-Websocket-Protocol` header instead of `Cookie`. See https://stackoverflow.com/a/77060459
			logger.debug("[WebSocket] Success! User is logged in.");
		} catch {
			logger.debug("[WebSocket] Fail! User is not logged in.");
			close(WebSocketCode.VIOLATED_CONTRACT, "You must be logged in to access user data");
			return;
		}

		const collection = new CollectionReference(user, collectionId);
		let unsubscribe: Unsubscribe;
		if (documentId !== null) {
			const ref = new DocumentReference(collection, documentId);
			unsubscribe = watchUpdatesToDocument(c, ref, data => {
				logger.debug(`Got update for document at ${ref.path}`);
				send("data", {
					message: "Here's your data",
					dataType: "single",
					data,
				});
			});
		} else {
			unsubscribe = watchUpdatesToCollection(c, collection, data => {
				logger.debug(`Got update for collection at ${collection.path}`);
				send("data", {
					message: "Here's your data",
					dataType: "multiple",
					data,
				});
			});
		}

		onMessage("stop", () => {
			close(WebSocketCode.NORMAL, "Received STOP message from client");
		});

		onClose(unsubscribe);
	}
);
