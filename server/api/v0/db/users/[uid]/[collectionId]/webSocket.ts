import type { Infer } from "superstruct";
import type { Unsubscribe } from "../../../../../../database/index.js";
import type { WebsocketRequestHandler } from "express-ws";
import { array, enums, nullable, object, optional, union } from "superstruct";
import { assertCallerIsOwner } from "../../../../../../auth/assertCallerIsOwner.js";
import { requireAuth } from "../../../../../../auth/requireAuth.js";
import { WebSocketCode } from "../../../../../../networking/WebSocketCode.js";
import { ws } from "../../../../../../networking/websockets.js";
import {
	allCollectionIds,
	identifiedDataItem,
	isValidForSchema,
	nonemptyString,
} from "../../../../../../database/schemas.js";
import {
	CollectionReference,
	DocumentReference,
	watchUpdatesToCollection,
	watchUpdatesToDocument,
} from "../../../../../../database/index.js";

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
		data(tbd): tbd is WatcherData {
			return isValidForSchema(tbd, watcherData);
		},
	},
	// params
	object({
		uid: nonemptyString,
		collectionId: enums(allCollectionIds),
		documentId: optional(nullable(nonemptyString)),
	}),
	// start
	async (context, params) => {
		const { req, onClose, onMessage, send, close } = context;
		const { uid, collectionId, documentId = null } = params;

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
			console.debug("[WebSocket] Checking auth state...");
			await requireAuth(req, fakeRes);
			console.debug("[WebSocket] Success! User is logged in.");
		} catch {
			console.debug("[WebSocket] Fail! User is not logged in.");
			close(WebSocketCode.VIOLATED_CONTRACT, "You must be logged in to access user data");
			return;
		}
		try {
			console.debug("[WebSocket] Checking that caller is owner...");
			await assertCallerIsOwner(req, fakeRes);
			console.debug("[WebSocket] Success! User is requesting their own data.");
		} catch {
			console.debug("[WebSocket] Fail! User is requesting someone else's data.");
			close(WebSocketCode.VIOLATED_CONTRACT, "You cannot access data that isn't yours");
			return;
		}

		const collection = new CollectionReference(uid, collectionId);
		let unsubscribe: Unsubscribe;
		if (documentId !== null) {
			const ref = new DocumentReference(collection, documentId);
			unsubscribe = watchUpdatesToDocument(ref, data => {
				console.debug(`Got update for document at ${ref.path}`);
				send("data", {
					message: "Here's your data",
					dataType: "single",
					data,
				});
			});
		} else {
			unsubscribe = watchUpdatesToCollection(collection, data => {
				console.debug(`Got update for collection at ${collection.path}`);
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
