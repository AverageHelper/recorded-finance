import { apiHandler, dispatchRequests } from "../../../../../../helpers/apiHandler";
import { assertCallerIsOwner } from "../../../../../../auth/assertCallerIsOwner";
import { NotFoundError } from "../../../../../../errors/NotFoundError";
import { pathSegments } from "../../../../../../helpers/pathSegments";
import { requireAuth } from "../../../../../../auth/requireAuth";
import { respondData, respondSuccess } from "../../../../../../responses";
import { statsForUser } from "../../../../../../database/reads";
import {
	CollectionReference,
	deleteCollection,
	getCollection,
	isCollectionId,
} from "../../../../../../database";

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

export default dispatchRequests({ GET, DELETE });
