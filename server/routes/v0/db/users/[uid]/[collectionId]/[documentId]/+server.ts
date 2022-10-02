import type { Params } from "./Params.js";
import type { Request, Response } from "express";
import { BadRequestError, NotFoundError } from "../../../../../../../errors/index.js";
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

function collectionRef(req: Request<Params>): CollectionReference | null {
	const uid = req.params.uid;
	const collectionId = req.params.collectionId;
	if (!isCollectionId(collectionId)) return null;

	return new CollectionReference(uid, collectionId);
}

function documentRef(req: Request<Params>): DocumentReference | null {
	const documentId = req.params.documentId;
	const collection = collectionRef(req);
	if (!collection) return null;

	return new DocumentReference(collection, documentId);
}

export async function GET(req: Request<Params>, res: Response): Promise<void> {
	const ref = documentRef(req);
	// console.debug(`Handling GET for document at ${ref?.path ?? "null"}`);
	if (!ref) throw new NotFoundError();

	const { data } = await getDocument(ref);
	// console.debug(`Found item: ${JSON.stringify(data, undefined, "  ")}`);
	respondData(res, data);
}

export async function POST(req: Request<Params, unknown, unknown>, res: Response): Promise<void> {
	const uid = req.params.uid;

	const providedData = req.body;
	if (!isDataItem(providedData) && !isUserKeys(providedData)) throw new BadRequestError();

	const ref = documentRef(req);
	if (!ref) throw new NotFoundError();

	await setDocument(ref, providedData);
	const { totalSpace, usedSpace } = await statsForUser(uid);
	respondSuccess(res, { totalSpace, usedSpace });
}

export async function DELETE(req: Request<Params>, res: Response): Promise<void> {
	const uid = req.params.uid;

	const ref = documentRef(req);
	if (!ref) throw new NotFoundError();

	// Delete the referenced database entry
	await deleteDocument(ref);

	// TODO: Delete any associated files

	const { totalSpace, usedSpace } = await statsForUser(uid);

	respondSuccess(res, { totalSpace, usedSpace });
}
