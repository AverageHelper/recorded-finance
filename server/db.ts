import { asyncWrapper } from "./asyncWrapper.js";
import { handleErrors } from "./handleErrors.js";
import { ownersOnly } from "./auth/ownersOnly.js";
import { requireAuth } from "./auth/requireAuth.js";
import { Router } from "express";

import { getFileBlob } from "./routes/v0/db/users/[uid]/attachments/[documentId]/blob/[fileName]/getFileBlob.js";
import {
	postFileBlob,
	upload,
} from "./routes/v0/db/users/[uid]/attachments/[documentId]/blob/[fileName]/postFileBlob.js";
import { deleteFileBlob } from "./routes/v0/db/users/[uid]/attachments/[documentId]/blob/[fileName]/deleteFileBlob.js";
import { webSocket } from "./routes/v0/db/users/[uid]/[collectionId]/webSocket.js";
import { getDataCollection } from "./routes/v0/db/users/[uid]/[collectionId]/getDataCollection.js";
import { getDataDocument } from "./routes/v0/db/users/[uid]/[collectionId]/[documentId]/getDataDocument.js";
import { postDataBatch } from "./routes/v0/db/users/[uid]/postDataBatch.js";
import { postDataDocument } from "./routes/v0/db/users/[uid]/[collectionId]/[documentId]/postDataDocument.js";
import { deleteDataCollection } from "./routes/v0/db/users/[uid]/[collectionId]/deleteDataCollection.js";
import { deleteDataDocument } from "./routes/v0/db/users/[uid]/[collectionId]/[documentId]/deleteDataDocument.js";

export function db(): Router {
	// Function, so we defer creation of the router until after we've set up websocket support
	return Router()
		.ws("/users/:uid/:collectionId", webSocket)
		.ws("/users/:uid/:collectionId/:documentId", webSocket)
		.use(requireAuth) // require auth from here on in
		.use("/users/:uid", ownersOnly)
		.get("/users/:uid/attachments/:documentId/blob/:fileName", asyncWrapper(getFileBlob))
		.post("/users/:uid/attachments/:documentId/blob/:fileName", upload, asyncWrapper(postFileBlob))
		.delete("/users/:uid/attachments/:documentId/blob/:fileName", asyncWrapper(deleteFileBlob))
		.get("/users/:uid/:collectionId", asyncWrapper(getDataCollection))
		.get("/users/:uid/:collectionId/:documentId", asyncWrapper(getDataDocument))
		.post("/users/:uid", asyncWrapper(postDataBatch))
		.post("/users/:uid/:collectionId/:documentId", asyncWrapper(postDataDocument))
		.delete("/users/:uid/:collectionId", asyncWrapper(deleteDataCollection))
		.delete("/users/:uid/:collectionId/:documentId", asyncWrapper(deleteDataDocument))
		.use(handleErrors);
}
