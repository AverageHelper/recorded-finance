import type { Context } from "hono";
import type { User } from "../../../../../../database/schemas";
import { apiHandler } from "../../../../../../helpers/apiHandler";
import { CollectionReference } from "../../../../../../database/references";
import { deleteCollection } from "../../../../../../database/write";
import { dataResponse, successResponse } from "../../../../../../responses";
import { fetchDbCollection as getCollection, statsForUser } from "../../../../../../database/read";
import { isCollectionId } from "../../../../../../database/schemas";
import { logger } from "../../../../../../logger";
import { NotFoundError } from "../../../../../../errors/NotFoundError";
import { requireAuth } from "../../../../../../auth/requireAuth";

const PATH = "/api/v0/db/users/:uid/:collectionId";

function collectionRef(user: User, c: Context<Env, typeof PATH>): CollectionReference | null {
	const collectionId = c.req.param("collectionId");
	if (!isCollectionId(collectionId)) return null;

	return new CollectionReference(user, collectionId);
}

export const GET = apiHandler(PATH, "GET", null, async c => {
	const collectionId = c.req.param("collectionId");
	if (collectionId === ".websocket") {
		logger.debug(
			`Received GET request for a collection called '.websocket'. Why are we here? It seems likely that the user intended to start a WebSocket session, but by accident they requested the WebSocket collection.`
		);
		// We'll proceed, since the unknown collection will result in a 404 anyhow
	}

	const user = await requireAuth(c);
	const ref = collectionRef(user, c);
	if (!ref) throw new NotFoundError();

	const items = await getCollection(c, ref);
	return dataResponse(c, items);
});

export const DELETE = apiHandler(PATH, "DELETE", null, async c => {
	const user = await requireAuth(c);
	const uid = user.uid;

	const ref = collectionRef(user, c);
	if (!ref) {
		// Unknown collection? Call it gone!
		const { totalSpace, usedSpace } = await statsForUser(c, uid);
		return successResponse(c, { totalSpace, usedSpace });
	}

	// Delete the referenced database entries
	await deleteCollection(c, ref);

	const { totalSpace, usedSpace } = await statsForUser(c, uid);

	return successResponse(c, { totalSpace, usedSpace });
});
