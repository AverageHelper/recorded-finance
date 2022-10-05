import { apiHandler } from "../../../../../../helpers/apiHandler.js";
import { assertCallerIsOwner } from "../../../../../../auth/assertCallerIsOwner.js";
import { NotFoundError } from "../../../../../../errors/index.js";
import { pathSegments } from "../../../../../../helpers/pathSegments.js";
import { requireAuth } from "../../../../../../auth/requireAuth.js";
import { respondData, respondSuccess } from "../../../../../../responses.js";
import { statsForUser } from "../../../../../../database/io.js";
import {
	CollectionReference,
	deleteCollection,
	getCollection,
	isCollectionId,
} from "../../../../../../database/index.js";

function collectionRef(req: APIRequest): CollectionReference | null {
	const { uid, collectionId } = pathSegments(req, "uid", "collectionId");
	if (!isCollectionId(collectionId)) return null;

	return new CollectionReference(uid, collectionId);
}

export const GET = apiHandler("GET", async (req, res) => {
	const { collectionId } = pathSegments(req, "collectionId");
	if (collectionId === ".websocket") {
		console.debug(`Received GET request for a collection called '.websocket'. Why are we here?`);
		return; // we were never meant to be here
	}

	await requireAuth(req, res);
	await assertCallerIsOwner(req, res);
	const ref = collectionRef(req);
	if (!ref) throw new NotFoundError();

	const items = await getCollection(ref);
	respondData(res, items);
});

export const DELETE = apiHandler("DELETE", async (req, res) => {
	await requireAuth(req, res);
	await assertCallerIsOwner(req, res);
	const { uid } = pathSegments(req, "uid");

	const ref = collectionRef(req);
	if (!ref) throw new NotFoundError();

	// Delete the referenced database entries
	await deleteCollection(ref);

	// TODO: Also delete associated files

	const { totalSpace, usedSpace } = await statsForUser(uid);

	// TODO: Also delete associated files

	respondSuccess(res, { totalSpace, usedSpace });
});
