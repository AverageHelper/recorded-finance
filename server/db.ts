import { asyncWrapper } from "./asyncWrapper.js";
import { handleErrors } from "./handleErrors.js";
import { ownersOnly } from "./auth/ownersOnly.js";
import { requireAuth } from "./auth/requireAuth.js";
import { Router } from "express";

import { webSocket } from "./routes/v0/db/users/[uid]/[collectionId]/webSocket.js";
import * as fileBlob from "./routes/v0/db/users/[uid]/attachments/[documentId]/blob/[fileName]/+server.js";
import * as dataBatch from "./routes/v0/db/users/[uid]/+server.js";
import * as dataCollection from "./routes/v0/db/users/[uid]/[collectionId]/+server.js";
import * as dataDocument from "./routes/v0/db/users/[uid]/[collectionId]/[documentId]/+server.js";

export function db(): Router {
	// Function, so we defer creation of the router until after we've set up websocket support
	return Router()
		.ws("/users/:uid/:collectionId", webSocket)
		.ws("/users/:uid/:collectionId/:documentId", webSocket)
		.use(requireAuth) // require auth from here on in
		.use("/users/:uid", ownersOnly)
		.post("/users/:uid", asyncWrapper(dataBatch.POST))
		.get("/users/:uid/attachments/:documentId/blob/:fileName", asyncWrapper(fileBlob.GET))
		.post(
			"/users/:uid/attachments/:documentId/blob/:fileName",
			fileBlob.upload,
			asyncWrapper(fileBlob.POST)
		)
		.delete("/users/:uid/attachments/:documentId/blob/:fileName", asyncWrapper(fileBlob.DELETE))
		.get("/users/:uid/:collectionId", asyncWrapper(dataCollection.GET))
		.delete("/users/:uid/:collectionId", asyncWrapper(dataCollection.DELETE))
		.get("/users/:uid/:collectionId/:documentId", asyncWrapper(dataDocument.GET))
		.post("/users/:uid/:collectionId/:documentId", asyncWrapper(dataDocument.POST))
		.delete("/users/:uid/:collectionId/:documentId", asyncWrapper(dataDocument.DELETE))
		.use(handleErrors);
}
