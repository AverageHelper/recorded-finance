import type { Unsubscribe } from "./database/read";
import { allCollectionIds, identifiedDataItem, nonemptyString } from "./database/schemas";
import { array, enums, literal, nullable, object, union, validate } from "superstruct";
import { BadRequestError } from "./errors/BadRequestError";
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

		data: union([
			object({
				message: nonemptyString,
				dataType: literal("single"),
				data: nullable(identifiedDataItem),
			}),
			object({
				message: nonemptyString,
				dataType: literal("multiple"),
				data: nullable(array(identifiedDataItem)),
			}),
		]),
	},

	// authenticate
	async c => {
		const _collectionId = c.req.param("collectionId");
		const _documentId = c.req.param("documentId");

		const [collectionIdError, collectionId] = validate(_collectionId, enums(allCollectionIds));
		const [documentIdError, documentId] = validate(_documentId ?? null, nullable(nonemptyString));

		if (collectionIdError) {
			throw new BadRequestError(collectionIdError.message);
		}
		if (documentIdError) {
			throw new BadRequestError(documentIdError.message);
		}

		const params = { collectionId, documentId } as const;

		try {
			logger.debug("[WebSocket] Checking auth state...");
			const user = await requireAuth(c); // FIXME: Apparently this is suboptimal. Use the `Sec-Websocket-Protocol` header instead of `Cookie`. See https://stackoverflow.com/a/77060459
			logger.debug("[WebSocket] Success! User is logged in.");
			return [user, params];
		} catch (error) {
			logger.debug("[WebSocket] Fail! User is not logged in.");
			throw error;
		}
	},

	// start
	connection => {
		const { context: c, user, params, onClose, onMessage, send, close } = connection;
		const { collectionId, documentId = null } = params;

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
