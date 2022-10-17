import { asyncWrapper } from "./asyncWrapper";
import { Router } from "express";

import { webSocket } from "./webSocket";
import * as fileBlob from "./api/v0/db/users/[uid]/attachments/[documentId]/blob/[fileName]";
import * as dataBatch from "./api/v0/db/users/[uid]";
import * as dataCollection from "./api/v0/db/users/[uid]/[collectionId]";
import * as dataDocument from "./api/v0/db/users/[uid]/[collectionId]/[documentId]";

export function db(): Router {
	// Function, so we defer creation of the router until after we've set up websocket support
	return (
		Router()
			.ws("/users/:uid/:collectionId", webSocket)
			.ws("/users/:uid/:collectionId/:documentId", webSocket)
			// Each of these should call `requireAuth` from here on in
			.post("/users/:uid", asyncWrapper(dataBatch.POST))
			.get("/users/:uid/attachments/:documentId/blob/:fileName", asyncWrapper(fileBlob.GET))
			.post("/users/:uid/attachments/:documentId/blob/:fileName", asyncWrapper(fileBlob.POST))
			.delete("/users/:uid/attachments/:documentId/blob/:fileName", asyncWrapper(fileBlob.DELETE))
			.get("/users/:uid/:collectionId", asyncWrapper(dataCollection.GET))
			.delete("/users/:uid/:collectionId", asyncWrapper(dataCollection.DELETE))
			.get("/users/:uid/:collectionId/:documentId", asyncWrapper(dataDocument.GET))
			.post("/users/:uid/:collectionId/:documentId", asyncWrapper(dataDocument.POST))
			.delete("/users/:uid/:collectionId/:documentId", asyncWrapper(dataDocument.DELETE))
	);
}
