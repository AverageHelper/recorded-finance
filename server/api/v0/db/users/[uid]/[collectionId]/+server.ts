import { assertMethod } from "../../../../../../helpers/assertMethod.js";
import { NotFoundError } from "../../../../../../errors/index.js";
import { pathSegments } from "../../../../../../helpers/pathSegments.js";
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

export async function GET(req: APIRequest, res: APIResponse): Promise<void> {
	assertMethod(req.method, "GET");
	const ref = collectionRef(req);
	if (!ref) throw new NotFoundError();

	const items = await getCollection(ref);
	respondData(res, items);
}

export async function DELETE(req: APIRequest, res: APIResponse): Promise<void> {
	assertMethod(req.method, "DELETE");
	const { uid } = pathSegments(req, "uid");

	const ref = collectionRef(req);
	if (!ref) throw new NotFoundError();

	// Delete the referenced database entries
	await deleteCollection(ref);

	// TODO: Also delete associated files

	const { totalSpace, usedSpace } = await statsForUser(uid);

	// TODO: Also delete associated files

	respondSuccess(res, { totalSpace, usedSpace });
}
