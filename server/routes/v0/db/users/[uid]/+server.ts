import type { DocUpdate } from "../../../../../database/io.js";
import type { Params } from "./Params";
import type { Request, Response } from "express";
import { BadRequestError } from "../../../../../errors/index.js";
import { statsForUser } from "../../../../../database/io.js";
import { respondSuccess } from "../../../../../responses.js";
import {
	CollectionReference,
	DocumentReference,
	deleteDocuments,
	isArrayOf,
	isDocumentWriteBatch,
	isNonEmptyArray,
	setDocuments,
} from "../../../../../database/index.js";

export async function POST(req: Request<Params, unknown, unknown>, res: Response): Promise<void> {
	const uid = req.params.uid;

	// ** Batched writes
	const providedData = req.body;
	if (!isArrayOf(providedData, isDocumentWriteBatch)) throw new BadRequestError();

	// Ignore an empty batch
	if (!isNonEmptyArray(providedData)) {
		const { totalSpace, usedSpace } = await statsForUser(uid);
		return respondSuccess(res, { totalSpace, usedSpace });
	}

	// Separate delete and set operations
	const setOperations: Array<DocUpdate> = [];
	const deleteOperations: Array<DocumentReference> = [];
	for (const write of providedData) {
		const collection = new CollectionReference(uid, write.ref.collectionId);
		const ref = new DocumentReference(collection, write.ref.documentId);

		switch (write.type) {
			case "set":
				setOperations.push({ ref, data: write.data });
				break;
			case "delete":
				deleteOperations.push(ref);
				break;
		}
	}

	// Run sets
	if (isNonEmptyArray(setOperations)) {
		await setDocuments(setOperations);
	}

	// Run deletes
	if (isNonEmptyArray(deleteOperations)) {
		await deleteDocuments(deleteOperations);
	}

	const { totalSpace, usedSpace } = await statsForUser(uid);
	respondSuccess(res, { totalSpace, usedSpace });
}
