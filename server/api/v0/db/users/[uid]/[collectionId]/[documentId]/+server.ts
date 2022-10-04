import { assertMethod } from "../../../../../../../helpers/assertMethod.js";
import { BadRequestError, NotFoundError } from "../../../../../../../errors/index.js";
import { pathSegments } from "../../../../../../../helpers/pathSegments.js";
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

export async function GET(req: APIRequest, res: APIResponse): Promise<void> {
	assertMethod(req.method, "GET");

	const ref = documentRef(req);
	// console.debug(`Handling GET for document at ${ref?.path ?? "null"}`);
	if (!ref) throw new NotFoundError();

	const { data } = await getDocument(ref);
	// console.debug(`Found item: ${JSON.stringify(data, undefined, "  ")}`);
	respondData(res, data);
}

export async function POST(req: APIRequest, res: APIResponse): Promise<void> {
	assertMethod(req.method, "POST");
	const { uid } = pathSegments(req, "uid");

	const providedData = req.body as unknown;
	if (!isDataItem(providedData) && !isUserKeys(providedData)) throw new BadRequestError();

	const ref = documentRef(req);
	if (!ref) throw new NotFoundError();

	await setDocument(ref, providedData);
	const { totalSpace, usedSpace } = await statsForUser(uid);
	respondSuccess(res, { totalSpace, usedSpace });
}

export async function DELETE(req: APIRequest, res: APIResponse): Promise<void> {
	assertMethod(req.method, "DELETE");
	const { uid } = pathSegments(req, "uid");

	const ref = documentRef(req);
	if (!ref) throw new NotFoundError();

	// Delete the referenced database entry
	await deleteDocument(ref);

	// TODO: Delete any associated files

	const { totalSpace, usedSpace } = await statsForUser(uid);

	respondSuccess(res, { totalSpace, usedSpace });
}
