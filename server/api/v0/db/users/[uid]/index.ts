import type { DocUpdate } from "../../../../../database/io";
import { apiHandler } from "../../../../../helpers/apiHandler";
import { assertCallerIsOwner } from "../../../../../auth/assertCallerIsOwner";
import { BadRequestError } from "../../../../../errors";
import { pathSegments } from "../../../../../helpers/pathSegments";
import { statsForUser } from "../../../../../database/io";
import { requireAuth } from "../../../../../auth/requireAuth";
import { respondSuccess } from "../../../../../responses";
import {
	CollectionReference,
	DocumentReference,
	deleteDocuments,
	isArrayOf,
	isDocumentWriteBatch,
	isNonEmptyArray,
	setDocuments,
} from "../../../../../database";

export const POST = apiHandler("POST", async (req, res) => {
	await requireAuth(req, res);
	await assertCallerIsOwner(req, res);
	const { uid } = pathSegments(req, "uid");

	// ** Batched writes
	const providedData = req.body as unknown;
	if (!isArrayOf(providedData, isDocumentWriteBatch)) throw new BadRequestError();

	// Ignore an empty batch
	if (!isNonEmptyArray(providedData)) {
		const { totalSpace, usedSpace } = await statsForUser(uid);
		return respondSuccess(res, { totalSpace, usedSpace });
	}

	if (Array.isArray(providedData) && providedData.length > 500)
		throw new BadRequestError("Batch operations cannot contain more than 500 documents");

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
});

export default POST;
