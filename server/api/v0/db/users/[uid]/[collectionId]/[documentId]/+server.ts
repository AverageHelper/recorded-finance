import { apiHandler } from "../../../../../../../helpers/apiHandler.js";
import { assertCallerIsOwner } from "../../../../../../../auth/assertCallerIsOwner.js";
import { BadRequestError, NotFoundError } from "../../../../../../../errors/index.js";
import { pathSegments } from "../../../../../../../helpers/pathSegments.js";
import { requireAuth } from "../../../../../../../auth/requireAuth.js";
import { respondData, respondSuccess } from "../../../../../../../responses.js";
import { statsForUser } from "../../../../../../../database/io.js";
import {
	CollectionReference,
	DocumentReference,
	deleteDocument,
	getDocument,
	isCollectionId,
	isDataItem,
	isUserKeys,
	setDocument,
} from "../../../../../../../database/index.js";

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