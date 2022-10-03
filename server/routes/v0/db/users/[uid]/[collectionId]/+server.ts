import type { Params } from "./Params.js";
import type { Request, Response } from "express";
import { NotFoundError } from "../../../../../../errors/index.js";
import { respondData, respondSuccess } from "../../../../../../responses.js";
import { statsForUser } from "../../../../../../database/io.js";
import {
	CollectionReference,
	deleteCollection,
	getCollection,
	isCollectionId,
} from "../../../../../../database/index.js";

function collectionRef(req: Request<Params>): CollectionReference | null {
	const uid = req.params.uid;
	const collectionId = req.params.collectionId;
	if (!isCollectionId(collectionId)) return null;

	return new CollectionReference(uid, collectionId);
}

export async function GET(req: Request<Params>, res: Response): Promise<void> {
	const ref = collectionRef(req);
	if (!ref) throw new NotFoundError();

	const items = await getCollection(ref);
	respondData(res, items);
}

export async function DELETE(req: Request<Params>, res: Response): Promise<void> {
	const uid = req.params.uid;

	const ref = collectionRef(req);
	if (!ref) throw new NotFoundError();

	// Delete the referenced database entries
	await deleteCollection(ref);

	// TODO: Also delete associated files

	const { totalSpace, usedSpace } = await statsForUser(uid);

	// TODO: Also delete associated files

	respondSuccess(res, { totalSpace, usedSpace });
}
