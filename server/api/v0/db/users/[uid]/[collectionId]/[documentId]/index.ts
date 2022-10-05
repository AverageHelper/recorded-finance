import type { VercelRequest, VercelResponse } from "@vercel/node";
import { apiHandler } from "../../../../../../../helpers/apiHandler";
import { assertCallerIsOwner } from "../../../../../../../auth/assertCallerIsOwner";
import { BadMethodError, BadRequestError, NotFoundError } from "../../../../../../../errors";
import { pathSegments } from "../../../../../../../helpers/pathSegments";
import { requireAuth } from "../../../../../../../auth/requireAuth";
import { respondData, respondError, respondSuccess } from "../../../../../../../responses";
import { statsForUser } from "../../../../../../../database/io";
import {
	CollectionReference,
	DocumentReference,
	deleteDocument,
	getDocument,
	isCollectionId,
	isDataItem,
	isUserKeys,
	setDocument,
} from "../../../../../../../database";

function collectionRef(req: APIRequest): CollectionReference | null {
	const { uid, collectionId } = pathSegments(req, "uid", "collectionId");
	if (!isCollectionId(collectionId)) return null;

	return new CollectionReference(uid, collectionId);
}

function documentRef(req: APIRequest): DocumentReference | null {
	const { documentId } = pathSegments(req, "documentId");
	const collection = collectionRef(req);
	if (!collection) return null;

	return new DocumentReference(collection, documentId);
}

export const GET = apiHandler("GET", async (req, res) => {
	const { documentId } = pathSegments(req, "documentId");
	if (documentId === ".websocket") {
		console.debug(`Received GET request for a document called '.websocket'. Why are we here?`);
		return; // we were never meant to be here
	}

	await requireAuth(req, res);
	await assertCallerIsOwner(req, res);

	const ref = documentRef(req);
	// console.debug(`Handling GET for document at ${ref?.path ?? "null"}`);
	if (!ref) throw new NotFoundError();

	const { data } = await getDocument(ref);
	// console.debug(`Found item: ${JSON.stringify(data, undefined, "  ")}`);
	respondData(res, data);
});

export const POST = apiHandler("POST", async (req, res) => {
	await requireAuth(req, res);
	await assertCallerIsOwner(req, res);
	const { uid } = pathSegments(req, "uid");

	const providedData = req.body as unknown;
	if (!isDataItem(providedData) && !isUserKeys(providedData)) throw new BadRequestError();

	const ref = documentRef(req);
	if (!ref) throw new NotFoundError();

	await setDocument(ref, providedData);
	const { totalSpace, usedSpace } = await statsForUser(uid);
	respondSuccess(res, { totalSpace, usedSpace });
});

export const DELETE = apiHandler("DELETE", async (req, res) => {
	await requireAuth(req, res);
	await assertCallerIsOwner(req, res);
	const { uid } = pathSegments(req, "uid");

	const ref = documentRef(req);
	if (!ref) throw new NotFoundError();

	// Delete the referenced database entry
	await deleteDocument(ref);

	// TODO: Delete any associated files

	const { totalSpace, usedSpace } = await statsForUser(uid);

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
		case "POST":
			await POST(req, res);
			break;
		default:
			respondError(res, new BadMethodError());
			break;
	}
};
