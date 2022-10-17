import type { User } from "../../../../../../../database/schemas";
import { apiHandler, dispatchRequests } from "../../../../../../../helpers/apiHandler";
import { assertCallerIsOwner } from "../../../../../../../auth/assertCallerIsOwner";
import { BadRequestError } from "../../../../../../../errors/BadRequestError";
import { NotFoundError } from "../../../../../../../errors/NotFoundError";
import { pathSegments } from "../../../../../../../helpers/pathSegments";
import { requireAuth } from "../../../../../../../auth/requireAuth";
import { respondData, respondSuccess } from "../../../../../../../responses";
import { statsForUser } from "../../../../../../../database/reads";
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

function collectionRef(user: User, req: APIRequest): CollectionReference | null {
	const { collectionId } = pathSegments(req, "collectionId");
	if (!isCollectionId(collectionId)) return null;

	return new CollectionReference(user, collectionId);
}

function documentRef(user: User, req: APIRequest): DocumentReference | null {
	const { documentId } = pathSegments(req, "documentId");
	const collection = collectionRef(user, req);
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
	const user = await assertCallerIsOwner(req, res);

	const ref = documentRef(user, req);
	// console.debug(`Handling GET for document at ${ref?.path ?? "null"}`);
	if (!ref) throw new NotFoundError();

	const { data } = await getDocument(ref);
	// console.debug(`Found item: ${JSON.stringify(data, undefined, "  ")}`);
	respondData(res, data);
});

export const POST = apiHandler("POST", async (req, res) => {
	await requireAuth(req, res);
	const user = await assertCallerIsOwner(req, res);
	const uid = user.uid;

	const providedData = req.body as unknown;
	if (!isDataItem(providedData) && !isUserKeys(providedData)) throw new BadRequestError();

	const ref = documentRef(user, req);
	if (!ref) throw new NotFoundError();

	await setDocument(ref, providedData);
	const { totalSpace, usedSpace } = await statsForUser(uid);
	respondSuccess(res, { totalSpace, usedSpace });
});

export const DELETE = apiHandler("DELETE", async (req, res) => {
	await requireAuth(req, res);
	const user = await assertCallerIsOwner(req, res);
	const uid = user.uid;

	const ref = documentRef(user, req);
	if (!ref) throw new NotFoundError();

	// Delete the referenced database entry
	await deleteDocument(ref);

	// TODO: Delete any associated files

	const { totalSpace, usedSpace } = await statsForUser(uid);

	respondSuccess(res, { totalSpace, usedSpace });
});

export default dispatchRequests({ GET, DELETE, POST });
