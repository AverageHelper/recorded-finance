import type { DocumentData } from "./database/schemas.js";
import type { DocUpdate } from "./database/io.js";
import type { Infer } from "superstruct";
import type { Request } from "express";
import type { Unsubscribe } from "./database/index.js";
import type { WebsocketRequestHandler } from "express-ws";
import { asyncWrapper } from "./asyncWrapper.js";
import { array, enums, nullable, object, optional, union } from "superstruct";
import { BadRequestError, NotEnoughRoomError, NotFoundError } from "./errors/index.js";
import { destroyFileData, fetchFileData, statsForUser, upsertFileData } from "./database/io.js";
import { handleErrors } from "./handleErrors.js";
import { maxSpacePerUser, MAX_FILE_BYTES } from "./auth/limits.js";
import { ownersOnly } from "./auth/ownersOnly.js";
import { requireAuth } from "./auth/requireAuth.js";
import { respondData, respondSuccess } from "./responses.js";
import { sep as pathSeparator } from "node:path";
import { Router } from "express";
import { simplifiedByteCount } from "./transformers/simplifiedByteCount.js";
import { WebSocketCode } from "./networking/WebSocketCode.js";
import { ws } from "./networking/websockets.js"; // TODO: Load websockets optionally, only if we're not on Vercel
import multer, { memoryStorage } from "multer";
import {
	allCollectionIds,
	identifiedDataItem,
	isValidForSchema,
	nonemptyString,
} from "./database/schemas.js";
import {
	CollectionReference,
	DocumentReference,
	deleteCollection,
	deleteDocument,
	deleteDocuments,
	getCollection,
	getDocument,
	isArrayOf,
	isCollectionId,
	isDataItem,
	isDocumentWriteBatch,
	isNonEmptyArray,
	isUserKeys,
	setDocument,
	setDocuments,
	watchUpdatesToCollection,
	watchUpdatesToDocument,
} from "./database/index.js";

interface Params {
	uid?: string;
	collectionId?: string;
	documentId?: string;
	fileName?: string;
}

function collectionRef(req: Request<Params>): CollectionReference | null {
	const uid = (req.params.uid ?? "") || null;
	const collectionId = req.params.collectionId ?? "";
	if (uid === null || !isCollectionId(collectionId)) return null;

	return new CollectionReference(uid, collectionId);
}

function documentRef(req: Request<Params>): DocumentReference | null {
	const documentId = req.params.documentId ?? "";
	const collection = collectionRef(req);
	if (!collection) return null;

	return new DocumentReference(collection, documentId);
}

/**
 * Asserts that the given value is a valid file path segment.
 *
 * @param value The path segment
 * @param name A string that identifies the value in error reports
 *
 * @throws a {@link BadRequestError} if `value` is not a valid file path segment.
 * @returns the given `value`
 */
function assertPathSegment(value: string | undefined, name: string): string {
	if (value === undefined || !value) throw new BadRequestError(`Missing ${name}`);

	// Make sure value doesn't contain a path separator
	if (value.includes(pathSeparator) || value.includes(".."))
		throw new BadRequestError(
			`${name} cannot contain a '${pathSeparator}' character or a parent directory marker`
		);

	return value.trim();
}

/**
 * Ensures that the appropriate parameters are present and valid file path segments.
 */
function requireFilePathParameters(params: Params): Required<Omit<Params, "collectionId">> {
	const { uid, documentId, fileName } = params;

	return {
		uid: assertPathSegment(uid, "uid"),
		documentId: assertPathSegment(documentId, "documentId"),
		fileName: assertPathSegment(fileName, "fileName"),
	};
}

const watcherData = object({
	message: nonemptyString,
	dataType: enums(["single", "multiple"] as const),
	data: nullable(union([array(identifiedDataItem), identifiedDataItem])),
});

type WatcherData = Infer<typeof watcherData>;

const webSocket: WebsocketRequestHandler = ws(
	// interactions
	{
		stop(tbd): tbd is "STOP" {
			return tbd === "STOP";
		},
		data(tbd): tbd is WatcherData {
			return isValidForSchema(tbd, watcherData);
		},
	},
	// params
	object({
		uid: nonemptyString,
		documentId: optional(nullable(nonemptyString)),
		collectionId: enums(allCollectionIds),
	}),
	// start
	(context, params) => {
		const { onClose, onMessage, send, close } = context;
		const { uid, collectionId, documentId = null } = params;
		const collection = new CollectionReference(uid, collectionId);
		let unsubscribe: Unsubscribe;
		// TODO: Assert the caller's ID is uid using some protocol
		if (documentId !== null) {
			const ref = new DocumentReference(collection, documentId);
			unsubscribe = watchUpdatesToDocument(ref, data => {
				console.debug(`Got update for document at ${ref.path}`);
				send("data", {
					message: "Here's your data",
					dataType: "single",
					data,
				});
			});
		} else {
			unsubscribe = watchUpdatesToCollection(collection, data => {
				console.debug(`Got update for collection at ${collection.path}`);
				send("data", {
					message: "Here's your data",
					dataType: "multiple",
					data,
				});
			});
		}

		onMessage("stop", () => {
			close(WebSocketCode.NORMAL, "Received STOP message from client");
		});

		onClose(unsubscribe);
	}
);

interface FileData {
	contents: string;
	_id: string;
}

// Function so we defer creation of the router until after we've set up websocket support
export function db(): Router {
	return Router()
		.ws("/users/:uid/:collectionId", webSocket)
		.ws("/users/:uid/:collectionId/:documentId", webSocket)
		.use(requireAuth) // require auth from here on in
		.use("/users/:uid", ownersOnly)
		.get<Params>(
			"/users/:uid/attachments/:documentId/blob/:fileName",
			asyncWrapper(async (req, res) => {
				const { uid: userId, fileName } = requireFilePathParameters(req.params);

				const file = await fetchFileData(userId, fileName);
				if (file === null) throw new NotFoundError();

				const contents = file.contents.toString("utf8");
				const fileData: DocumentData<FileData> = {
					contents,
					_id: req.params.fileName ?? "unknown",
				};
				respondData(res, fileData);
			})
		)
		.post(
			"/users/:uid/attachments/:documentId/blob/:fileName",
			multer({
				storage: memoryStorage(),
				limits: {
					fileSize: MAX_FILE_BYTES, // 4.2 MB
					files: 1,
				},
			}).single("file"),
			asyncWrapper<Params>(async (req, res) => {
				if (!req.file) throw new BadRequestError("You must include a file to store");

				const userId: string | null = (req.params.uid ?? "") || null;
				if (userId === null) throw new NotFoundError();
				const { fileName } = requireFilePathParameters(req.params);

				const { totalSpace, usedSpace } = await statsForUser(userId);
				const userSizeDesc = simplifiedByteCount(usedSpace);
				const maxSpacDesc = simplifiedByteCount(maxSpacePerUser);
				console.debug(`User ${userId} has used ${userSizeDesc} of ${maxSpacDesc}`);

				const remainingSpace = totalSpace - usedSpace;
				if (remainingSpace <= 0) throw new NotEnoughRoomError();

				const contents = req.file.buffer; // this better be utf8
				await upsertFileData({ userId, fileName, contents });

				{
					const { totalSpace, usedSpace } = await statsForUser(userId);
					respondSuccess(res, { totalSpace, usedSpace });
				}
			})
		)
		.delete<Params>(
			"/users/:uid/attachments/:documentId/blob/:fileName",
			asyncWrapper(async (req, res) => {
				const userId = (req.params.uid ?? "") || null;
				if (userId === null) throw new NotFoundError();

				const { fileName } = requireFilePathParameters(req.params);
				await destroyFileData(userId, fileName);

				// Report the user's new usage
				const { totalSpace, usedSpace } = await statsForUser(userId);
				const userSizeDesc = simplifiedByteCount(usedSpace);
				const maxSpacDesc = simplifiedByteCount(maxSpacePerUser);
				console.debug(`User ${userId} has used ${userSizeDesc} of ${maxSpacDesc}`);

				// When done, get back to the caller with new stats
				respondSuccess(res, { totalSpace, usedSpace });
			})
		)
		.get<Params>(
			"/users/:uid/:collectionId",
			asyncWrapper(async (req, res) => {
				const ref = collectionRef(req);
				if (!ref) throw new NotFoundError();

				const items = await getCollection(ref);
				respondData(res, items);
			})
		)
		.get<Params>(
			"/users/:uid/:collectionId/:documentId",
			asyncWrapper(async (req, res) => {
				const ref = documentRef(req);
				// console.debug(`Handling GET for document at ${ref?.path ?? "null"}`);
				if (!ref) throw new NotFoundError();

				const { data } = await getDocument(ref);
				// console.debug(`Found item: ${JSON.stringify(data, undefined, "  ")}`);
				respondData(res, data);
			})
		)
		.post(
			"/users/:uid",
			asyncWrapper<Params>(async (req, res) => {
				const uid = (req.params.uid ?? "") || null;
				if (uid === null) throw new NotFoundError();

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
			})
		)
		.post<Params>(
			"/users/:uid/:collectionId/:documentId",
			asyncWrapper(async (req, res) => {
				const uid = (req.params.uid ?? "") || null;
				if (uid === null) throw new NotFoundError();

				const providedData = req.body as unknown;
				if (!isDataItem(providedData) && !isUserKeys(providedData)) throw new BadRequestError();

				const ref = documentRef(req);
				if (!ref) throw new NotFoundError();

				await setDocument(ref, providedData);
				const { totalSpace, usedSpace } = await statsForUser(uid);
				respondSuccess(res, { totalSpace, usedSpace });
			})
		)
		.delete<Params>(
			"/users/:uid/:collectionId",
			asyncWrapper(async (req, res) => {
				const uid = (req.params.uid ?? "") || null;
				if (uid === null) throw new NotFoundError();

				const ref = collectionRef(req);
				if (!ref) throw new NotFoundError();

				// Delete the referenced database entries
				await deleteCollection(ref);

				// TODO: Also delete associated files

				const { totalSpace, usedSpace } = await statsForUser(uid);

				// TODO: Also delete associated files

				respondSuccess(res, { totalSpace, usedSpace });
			})
		)
		.delete<Params>(
			"/users/:uid/:collectionId/:documentId",
			asyncWrapper(async (req, res) => {
				const uid = (req.params.uid ?? "") || null;
				if (uid === null) throw new NotFoundError();

				const ref = documentRef(req);
				if (!ref) throw new NotFoundError();

				// Delete the referenced database entry
				await deleteDocument(ref);

				// TODO: Delete any associated files

				const { totalSpace, usedSpace } = await statsForUser(uid);

				respondSuccess(res, { totalSpace, usedSpace });
			})
		)
		.use(handleErrors);
}
