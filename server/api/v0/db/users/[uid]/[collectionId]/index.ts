import type { VercelRequest, VercelResponse } from "@vercel/node";
import { apiHandler } from "../../../../../../helpers/apiHandler";
import { assertCallerIsOwner } from "../../../../../../auth/assertCallerIsOwner";
import { BadMethodError } from "../../../../../../errors/BadMethodError";
import { NotFoundError } from "../../../../../../errors/NotFoundError";
import { pathSegments } from "../../../../../../helpers/pathSegments";
import { requireAuth } from "../../../../../../auth/requireAuth";
import { respondData, respondError, respondSuccess } from "../../../../../../responses";
import { statsForUser } from "../../../../../../database/io";
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

export default async (req: VercelRequest, res: VercelResponse): Promise<void> => {
	switch (req.method) {
		case "GET":
			await GET(req, res);
			break;
		case "DELETE":
			await DELETE(req, res);
			break;
		default:
			respondError(res, new BadMethodError());
			break;
	}
};
