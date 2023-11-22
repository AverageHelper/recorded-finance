import type { DocUpdate } from "../../../../../database/write";
import { apiHandler, dispatchRequests } from "../../../../../helpers/apiHandler";
import { array } from "superstruct";
import { BadRequestError } from "../../../../../errors/BadRequestError";
import { CollectionReference, DocumentReference } from "../../../../../database/references";
import { deleteDocuments, setDocuments } from "../../../../../database/write";
import { documentWriteBatch, isNonEmptyArray } from "../../../../../database/schemas";
import { requireAuth } from "../../../../../auth/requireAuth";
import { statsForUser } from "../../../../../database/read";
import { successResponse } from "../../../../../responses";

const PATH = "/api/v0/db/users/:uid";

export const POST = apiHandler(PATH, "POST", array(documentWriteBatch), async c => {
	const user = await requireAuth(c);
	const uid = user.uid; // `requireAuth` ensures this is the same value as the `uid` path param

	// ** Batched writes
	const providedData = c.req.valid("json");

	// Ignore an empty batch
	if (!isNonEmptyArray(providedData)) {
		const { totalSpace, usedSpace } = await statsForUser(c, uid);
		return successResponse(c, { totalSpace, usedSpace });
	}

	if (providedData.length > 500)
		throw new BadRequestError("Batch operations cannot contain more than 500 documents");

	// Separate delete and set operations
	const setOperations: Array<DocUpdate> = [];
	const deleteOperations: Array<DocumentReference> = [];
	for (const write of providedData) {
		const collection = new CollectionReference(user, write.ref.collectionId);
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

	// TODO: Make this a proper batch or transaction query

	// Run sets
	if (isNonEmptyArray(setOperations)) {
		await setDocuments(c, setOperations);
	}

	// Run deletes
	if (isNonEmptyArray(deleteOperations)) {
		await deleteDocuments(c, deleteOperations);
	}

	const { totalSpace, usedSpace } = await statsForUser(c, uid);
	return successResponse(c, { totalSpace, usedSpace });
});

export default dispatchRequests(PATH, { POST });
