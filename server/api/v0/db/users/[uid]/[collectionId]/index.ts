import type { Context } from "hono";
import type { User } from "../../../../../../database/schemas";
import { apiHandler, dispatchRequests } from "../../../../../../helpers/apiHandler";
import { CollectionReference } from "../../../../../../database/references";
import { dataResponse, successResponse } from "../../../../../../responses";
import { deleteCollection } from "../../../../../../database/write";
import { fetchDbCollection as getCollection, statsForUser } from "../../../../../../database/read";
import { isCollectionId } from "../../../../../../database/schemas";
import { NotFoundError } from "../../../../../../errors/NotFoundError";
import { requireAuth } from "../../../../../../auth/requireAuth";

const PATH = "/api/v0/db/users/:uid/:collectionId";

function collectionRef(user: User, c: Context<Env, typeof PATH>): CollectionReference | null {
	const collectionId = c.req.param("collectionId");
	if (!isCollectionId(collectionId)) return null;

	return new CollectionReference(user, collectionId);
}

export const GET = apiHandler(PATH, "GET", null, async c => {
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

export default dispatchRequests(PATH, { GET, DELETE });
