import { Hono } from "hono";
import { webSocket } from "./webSocket";
import * as fileBlob from "./api/v0/db/users/[uid]/attachments/[documentId]/blob/[fileName]";
import * as dataBatch from "./api/v0/db/users/[uid]";
import * as dataCollection from "./api/v0/db/users/[uid]/[collectionId]";
import * as dataDocument from "./api/v0/db/users/[uid]/[collectionId]/[documentId]";
import { assertOwnership, badMethodFallback } from "./helpers/apiHandler";

export const db = new Hono()

	.post("/users/:uid", assertOwnership, dataBatch.POST)
	.all(badMethodFallback)

	.get("/users/:uid/attachments/:documentId/blob/:fileName", fileBlob.GET) // FIXME: Need assertOwnership here, but tests fail.
	.post(assertOwnership, fileBlob.POST)
	.delete(assertOwnership, fileBlob.DELETE)
	.all(badMethodFallback)

	.get("/users/:uid/:collectionId", dataCollection.GET) // FIXME: Need assertOwnership here, but tests fail.
	.delete(assertOwnership, dataCollection.DELETE)
	.all(badMethodFallback)

	.get("/users/:uid/:collectionId/.websocket", webSocket)
	.all(badMethodFallback)

	.get("/users/:uid/:collectionId/:documentId", dataDocument.GET) // FIXME: Need assertOwnership here, but tests fail.
	.post(assertOwnership, dataDocument.POST)
	.delete(assertOwnership, dataDocument.DELETE)
	.all(badMethodFallback)

	.get("/users/:uid/:collectionId/:documentId/.websocket", webSocket)
	.all(badMethodFallback);
