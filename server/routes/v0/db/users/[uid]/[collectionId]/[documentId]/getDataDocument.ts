import type { Params } from "./Params.js";
import type { Request, Response } from "express";
import { NotFoundError } from "../../../../../../../errors/index.js";
import { respondData } from "../../../../../../../responses.js";
import {
	CollectionReference,
	DocumentReference,
	getDocument,
	isCollectionId,
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

export async function getDataDocument(req: Request<Params>, res: Response): Promise<void> {
	const ref = documentRef(req);
	// console.debug(`Handling GET for document at ${ref?.path ?? "null"}`);
	if (!ref) throw new NotFoundError();

	const { data } = await getDocument(ref);
	// console.debug(`Found item: ${JSON.stringify(data, undefined, "  ")}`);
	respondData(res, data);
}
