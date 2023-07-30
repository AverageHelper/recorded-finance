import type { Infer } from "superstruct";
import type { ReadonlyDeep } from "type-fest";
import type { Unsubscribe } from "./database/read";
import type { User } from "./database/schemas";
import type { WebsocketRequestHandler } from "express-ws";
import { array, enums, nullable, object, optional, union } from "superstruct";
import { CollectionReference, DocumentReference } from "./database/references";
import { logger } from "./logger";
import { requireAuth } from "./auth/requireAuth";
import { watchUpdatesToCollection, watchUpdatesToDocument } from "./database/read";
import { WebSocketCode } from "./networking/WebSocketCode";
import { ws } from "./networking/websockets";
import {
	allCollectionIds,
	identifiedDataItem,
	is,
	nonemptyString,
	uidSchema,
} from "./database/schemas";

const watcherData = object({
	message: nonemptyString,
	dataType: enums(["single", "multiple"] as const),
	data: nullable(union([array(identifiedDataItem), identifiedDataItem])),
});

type WatcherData = Infer<typeof watcherData>;

export const webSocket: WebsocketRequestHandler = ws(
	// interactions
	{
		stop(tbd): tbd is "STOP" {
			return tbd === "STOP";
		},
		data(tbd): tbd is ReadonlyDeep<WatcherData> {
			return is(tbd, watcherData);
		},
	},
	// params
	object({
		uid: uidSchema,
		collectionId: enums(allCollectionIds),
		documentId: optional(nullable(nonemptyString)),
	}),
	// start
	async (context, params) => {
		const { req, onClose, onMessage, send, close } = context;
		const { collectionId, documentId = null } = params;

		let user: User;

		// FIXME: Wish I could get request cookies here without corresponding response.
		// This leans a lot on implementation detail which may change later.
		// Options:
		// - Fork `cookies` to add a proper fallback when `res` is not provided
		// - Parse, verify, and read cookies myself, manually
		// - Don't use `express-ws`, use a third-party event delivery service like with Vercel
		const fakeRes = {
			getHeader: () => [],
			setHeader: () => fakeRes,
		} as unknown as APIResponse;
		try {
			logger.debug("[WebSocket] Checking auth state...");
			user = await requireAuth(req, fakeRes, true);
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
			unsubscribe = watchUpdatesToDocument(ref, data => {
				logger.debug(`Got update for document at ${ref.path}`);
				send("data", {
					message: "Here's your data",
					dataType: "single",
					data,
				});
			});
		} else {
			unsubscribe = watchUpdatesToCollection(collection, data => {
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
