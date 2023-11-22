import { assertOwnership, badMethodFallback } from "./helpers/apiHandler";
import { Hono } from "hono";
import { webSocket } from "./webSocket";
import * as fileBlob from "./api/v0/db/users/[uid]/attachments/[documentId]/blob/[fileName]";
import * as dataBatch from "./api/v0/db/users/[uid]";
import * as dataCollection from "./api/v0/db/users/[uid]/[collectionId]";
import * as dataDocument from "./api/v0/db/users/[uid]/[collectionId]/[documentId]";

export const db = new Hono<Env>({ strict: false })
	.post("/users/:uid", assertOwnership, dataBatch.POST)
	.all(badMethodFallback)

	.get("/users/:uid/attachments/:documentId/blob/:fileName", assertOwnership, fileBlob.GET)
	.post(assertOwnership, assertOwnership, fileBlob.POST)
	.delete(assertOwnership, assertOwnership, fileBlob.DELETE)
	.all(badMethodFallback)

	.get("/users/:uid/:collectionId", assertOwnership, dataCollection.GET)
	.delete(assertOwnership, assertOwnership, dataCollection.DELETE)
	.all(badMethodFallback)

	.get("/users/:uid/:collectionId/.websocket", assertOwnership, webSocket)
	.all(badMethodFallback)

	.get("/users/:uid/:collectionId/:documentId", assertOwnership, dataDocument.GET)
	.post(assertOwnership, assertOwnership, dataDocument.POST)
	.delete(assertOwnership, assertOwnership, dataDocument.DELETE)
	.all(badMethodFallback)

	.get("/users/:uid/:collectionId/:documentId/.websocket", assertOwnership, webSocket)
	.all(badMethodFallback);
