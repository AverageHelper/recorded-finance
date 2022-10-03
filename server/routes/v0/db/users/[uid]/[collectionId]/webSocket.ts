import type { Infer } from "superstruct";
import type { Unsubscribe } from "../../../../../../database/index.js";
import type { WebsocketRequestHandler } from "express-ws";
import { array, enums, nullable, object, optional, union } from "superstruct";
import { WebSocketCode } from "../../../../../../networking/WebSocketCode.js";
import { ws } from "../../../../../../networking/websockets.js"; // TODO: Load websockets optionally, only if we're not on Vercel
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
	(context, params) => {
		const { onClose, onMessage, send, close } = context;
		const { uid, collectionId, documentId = null } = params;
		const collection = new CollectionReference(uid, collectionId);
		let unsubscribe: Unsubscribe;
		// TODO: Assert the caller's ID is uid using some protocol
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
