import type { Params } from "./Params.js";
import type { Request, RequestHandler, Response } from "express";
import { BadRequestError, NotEnoughRoomError } from "../../../../../../../../../errors/index.js";
import { maxSpacePerUser, MAX_FILE_BYTES } from "../../../../../../../../../auth/limits.js";
import { respondSuccess } from "../../../../../../../../../responses.js";
import { sep as pathSeparator } from "node:path";
import { simplifiedByteCount } from "../../../../../../../../../transformers/simplifiedByteCount.js";
import { statsForUser, upsertFileData } from "../../../../../../../../../database/io.js";
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
function requireFilePathParameters(params: Params): Required<Params> {
	const { uid, documentId, fileName } = params;

	return {
		uid: assertPathSegment(uid, "uid"),
		documentId: assertPathSegment(documentId, "documentId"),
		fileName: assertPathSegment(fileName, "fileName"),
	};
}

export const upload = multer({
	storage: memoryStorage(),
	limits: {
		fileSize: MAX_FILE_BYTES, // 4.2 MB
		files: 1,
	},
}).single("file") as RequestHandler<Params & { [key: string]: string }>;

export async function postFileBlob(req: Request<Params>, res: Response): Promise<void> {
	if (!req.file) throw new BadRequestError("You must include a file to store");

	const userId = req.params.uid;
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
}
