import type { Context } from "hono";
import type { User } from "../../../../../../../database/schemas";
import { apiHandler } from "../../../../../../../helpers/apiHandler";
import { BadRequestError } from "../../../../../../../errors/BadRequestError";
import { CollectionReference, DocumentReference } from "../../../../../../../database/references";
import { dataItem, isCollectionId, userKeys } from "../../../../../../../database/schemas";
import { dataResponse, successResponse } from "../../../../../../../responses";
import { deleteDocument, setDocument } from "../../../../../../../database/write";
import { fetchDbDoc as getDocument, statsForUser } from "../../../../../../../database/read";
import { logger } from "../../../../../../../logger";
import { NotFoundError } from "../../../../../../../errors/NotFoundError";
import { requireAuth } from "../../../../../../../auth/requireAuth";
import { union } from "superstruct";

const PATH = "/api/v0/db/users/:uid/:collectionId/:documentId";

function collectionRef(user: User, c: Context<Env, typeof PATH>): CollectionReference | null {
	const collectionId = c.req.param("collectionId");
	if (!isCollectionId(collectionId)) return null;

	return new CollectionReference(user, collectionId);
}

function documentRef(user: User, c: Context<Env, typeof PATH>): DocumentReference | null {
	const documentId = c.req.param("documentId");
	const collection = collectionRef(user, c);
	if (!collection) return null;

	return new DocumentReference(collection, documentId);
}

export const GET = apiHandler(PATH, "GET", null, async c => {
	const documentId = c.req.param("documentId");
	if (documentId === ".websocket") {
		logger.debug(
			`Received GET request for a document called '.websocket'. Why are we here? It seems likely that the user intended to start a WebSocket session, but by accident they requested the WebSocket document.`
		);
		// We'll proceed, since the unknown document will be considered empty anyhow
	}

	const user = await requireAuth(c);

	const ref = documentRef(user, c);
	// logger.debug(`Handling GET for document at ${ref?.path ?? "null"}`);
	if (!ref) throw new NotFoundError();

	const doc = await getDocument(c, ref);
	const data = doc.data;
	// logger.debug(`Found item: ${JSON.stringify(data, undefined, "  ")}`);
	return dataResponse(c, data);
});

export const POST = apiHandler(PATH, "POST", union([dataItem, userKeys]), async c => {
	const user = await requireAuth(c);
	const uid = user.uid;

	const ref = documentRef(user, c);
	if (!ref) throw new BadRequestError(); // Unknown collection. The client should know what collections we support.

	const providedData = c.req.valid("json");

	await setDocument(c, ref, providedData);
	const { totalSpace, usedSpace } = await statsForUser(c, uid);
	return successResponse(c, { totalSpace, usedSpace });
});

export const DELETE = apiHandler(PATH, "DELETE", null, async c => {
	const user = await requireAuth(c);
	const uid = user.uid;

	const ref = documentRef(user, c);
	if (!ref) {
		// Unknown collection? Call the document gone!
		const { totalSpace, usedSpace } = await statsForUser(c, uid);
		return successResponse(c, { totalSpace, usedSpace });
	}

	// Delete the referenced database entry
	await deleteDocument(c, ref);

	const { totalSpace, usedSpace } = await statsForUser(c, uid);

	return successResponse(c, { totalSpace, usedSpace });
});
