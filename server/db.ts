import { asyncWrapper } from "./asyncWrapper";
import { Router } from "express";

import { webSocket } from "./webSocket";
import * as fileBlob from "./_api/v0/db/users/[uid]/attachments/[documentId]/blob/[fileName]";
import * as dataBatch from "./_api/v0/db/users/[uid]";
import * as dataCollection from "./_api/v0/db/users/[uid]/[collectionId]";
import * as dataDocument from "./_api/v0/db/users/[uid]/[collectionId]/[documentId]";

export function db(): Router {
	// Function, so we defer creation of the router until after we've set up websocket support
	return (
		Router()
			.ws("/users/:uid/:collectionId", webSocket)
			.ws("/users/:uid/:collectionId/:documentId", webSocket)
			// Each of these should call `requireAuth` from here on in
			.all("/users/:uid", asyncWrapper(dataBatch.POST))
			.get("/users/:uid/attachments/:documentId/blob/:fileName", asyncWrapper(fileBlob.GET))
			.post("/users/:uid/attachments/:documentId/blob/:fileName", asyncWrapper(fileBlob.POST))
			.all("/users/:uid/attachments/:documentId/blob/:fileName", asyncWrapper(fileBlob.DELETE))
			.get("/users/:uid/:collectionId", asyncWrapper(dataCollection.GET))
			.all("/users/:uid/:collectionId", asyncWrapper(dataCollection.DELETE))
			.get("/users/:uid/:collectionId/:documentId", asyncWrapper(dataDocument.GET))
			.post("/users/:uid/:collectionId/:documentId", asyncWrapper(dataDocument.POST))
			.all("/users/:uid/:collectionId/:documentId", asyncWrapper(dataDocument.DELETE))
	);
}
