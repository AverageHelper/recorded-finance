import type { Params } from "./Params";
import type { UID } from "../../../../../../../../../database/schemas";
import type {
	Request as ExpressRequest,
	RequestHandler,
	Response as ExpressResponse,
} from "express";
import { apiHandler, dispatchRequests } from "../../../../../../../../../helpers/apiHandler";
import { BadRequestError } from "../../../../../../../../../errors/BadRequestError";
import { destroyFileData, upsertFileData } from "../../../../../../../../../database/write";
import { fetchFileData, statsForUser } from "../../../../../../../../../database/read";
import { logger } from "../../../../../../../../../logger";
import { maxSpacePerUser, MAX_FILE_BYTES } from "../../../../../../../../../auth/limits";
import { NotEnoughRoomError } from "../../../../../../../../../errors/NotEnoughRoomError";
import { NotFoundError } from "../../../../../../../../../errors/NotFoundError";
import { pathSegments } from "../../../../../../../../../helpers/pathSegments";
import { requireAuth } from "../../../../../../../../../auth/requireAuth";
import { respondData, respondSuccess } from "../../../../../../../../../responses";
import { sep as pathSeparator } from "node:path";
import { simplifiedByteCount } from "../../../../../../../../../transformers/simplifiedByteCount";
import multer, { memoryStorage } from "multer";

/**
 * Asserts that the given value is a valid file path segment.
 *
 * @param value The path segment
 * @param name A string that identifies the value in error reports
 *
 * @throws a {@link BadRequestError} if `value` is not a valid file path segment.
 * @returns the given `value`
 */
function assertPathSegment(value: string, name: "uid"): UID;

function assertPathSegment(value: string, name: string): string;

function assertPathSegment(value: string, name: string): string {
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
function requireFilePathParameters(req: APIRequest): Required<Params> {
	const { uid, documentId, fileName } = pathSegments(req, "uid", "documentId", "fileName");

	return {
		uid: assertPathSegment(uid, "uid"),
		documentId: assertPathSegment(documentId, "documentId"),
		fileName: assertPathSegment(fileName, "fileName"),
	};
}

export const DELETE = apiHandler("DELETE", async (req, res) => {
	await requireAuth(req, res, true);
	const params = pathSegments(req, "uid", "documentId", "fileName");

	const userId = params.uid;

	const { fileName } = requireFilePathParameters(req);
	await destroyFileData(userId, fileName);

	// Report the user's new usage
	const { totalSpace, usedSpace } = await statsForUser(userId);
	const userSizeDesc = simplifiedByteCount(usedSpace);
	const maxSpacDesc = simplifiedByteCount(maxSpacePerUser);
	logger.debug(`User ${userId} has used ${userSizeDesc} of ${maxSpacDesc}`);

	// When done, get back to the caller with new stats
	respondSuccess(res, { totalSpace, usedSpace });
});

interface FileData {
	contents: string;
	_id: string;
}

export const GET = apiHandler("GET", async (req, res) => {
	await requireAuth(req, res, true);
	const { uid: userId, fileName } = requireFilePathParameters(req);

	const file = await fetchFileData(userId, fileName);
	if (file === null) throw new NotFoundError();

	const contents = file.contents.toString("utf8");
	respondData<FileData>(res, {
		contents,
		_id: fileName,
	});
});

export const POST = apiHandler("POST", async (req, res) => {
	await requireAuth(req, res, true);

	// Mimic Multer's middleware environment (see https://stackoverflow.com/a/68882562)
	const upload = multer({
		storage: memoryStorage(),
		limits: {
			fileSize: MAX_FILE_BYTES, // 4.2 MB
			files: 1,
		},
	}).single("file") as RequestHandler<{ [key: string]: string }>;
	await new Promise(resolve => {
		upload(req as ExpressRequest, res as ExpressResponse, resolve);
	});

	// We assume multer would install the `file` on a Vercel request the same as on Express
	const file = (req as ExpressRequest).file;
	if (!file) throw new BadRequestError("You must include a file to store");

	const { uid: userId, fileName } = requireFilePathParameters(req);

	const { totalSpace, usedSpace } = await statsForUser(userId);
	const userSizeDesc = simplifiedByteCount(usedSpace);
	const maxSpacDesc = simplifiedByteCount(maxSpacePerUser);
	logger.debug(`User ${userId} has used ${userSizeDesc} of ${maxSpacDesc}`);

	const remainingSpace = totalSpace - usedSpace;
	if (remainingSpace <= 0) throw new NotEnoughRoomError();

	const contents = file.buffer; // this better be utf8
	await upsertFileData({ userId, fileName, contents });

	{
		const { totalSpace, usedSpace } = await statsForUser(userId);
		respondSuccess(res, { totalSpace, usedSpace });
	}
});

export default dispatchRequests({ GET, DELETE, POST });
