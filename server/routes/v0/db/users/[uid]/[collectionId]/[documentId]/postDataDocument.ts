import type { Params } from "./Params.js";
import type { Request, Response } from "express";
import { BadRequestError, NotFoundError } from "../../../../../../../errors/index.js";
import { statsForUser } from "../../../../../../../database/io.js";
import { respondSuccess } from "../../../../../../../responses.js";
import {
	CollectionReference,
	DocumentReference,
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

export async function postDataDocument(
	req: Request<Params, unknown, unknown>,
	res: Response
): Promise<void> {
	const uid = req.params.uid;

	const providedData = req.body;
	if (!isDataItem(providedData) && !isUserKeys(providedData)) throw new BadRequestError();

	const ref = documentRef(req);
	if (!ref) throw new NotFoundError();

	await setDocument(ref, providedData);
	const { totalSpace, usedSpace } = await statsForUser(uid);
	respondSuccess(res, { totalSpace, usedSpace });
}
