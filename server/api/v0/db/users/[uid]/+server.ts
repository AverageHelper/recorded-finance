import type { DocUpdate } from "../../../../../database/io.js";
import { assertMethod } from "../../../../../helpers/assertMethod.js";
import { BadRequestError } from "../../../../../errors/index.js";
import { pathSegments } from "../../../../../helpers/pathSegments.js";
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

export async function POST(req: APIRequest, res: APIResponse): Promise<void> {
	assertMethod(req.method, "POST");
	const { uid } = pathSegments(req, "uid");

	// ** Batched writes
	const providedData = req.body as unknown;
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
