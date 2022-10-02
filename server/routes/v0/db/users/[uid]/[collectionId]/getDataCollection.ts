import type { Params } from "./Params.js";
import type { Request, Response } from "express";
import { NotFoundError } from "../../../../../../errors/index.js";
import { respondData } from "../../../../../../responses.js";
import {
	CollectionReference,
	getCollection,
	isCollectionId,
} from "../../../../../../database/index.js";

function collectionRef(req: Request<Params>): CollectionReference | null {
	const uid = req.params.uid;
	const collectionId = req.params.collectionId;
	if (!isCollectionId(collectionId)) return null;

	return new CollectionReference(uid, collectionId);
}

export async function getDataCollection(req: Request<Params>, res: Response): Promise<void> {
	const ref = collectionRef(req);
	if (!ref) throw new NotFoundError();

	const items = await getCollection(ref);
	respondData(res, items);
}
