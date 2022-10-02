import type { Params } from "./Params";
import type { Request, Response } from "express";
import { BadRequestError } from "../../../../../../../../../errors/index.js";
import { destroyFileData, statsForUser } from "../../../../../../../../../database/io.js";
import { maxSpacePerUser } from "../../../../../../../../../auth/limits.js";
import { respondSuccess } from "../../../../../../../../../responses.js";
import { sep as pathSeparator } from "node:path";
import { simplifiedByteCount } from "../../../../../../../../../transformers/simplifiedByteCount.js";

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

export async function deleteFileBlob(req: Request<Params>, res: Response): Promise<void> {
	const userId = req.params.uid;

	const { fileName } = requireFilePathParameters(req.params);
	await destroyFileData(userId, fileName);

	// Report the user's new usage
	const { totalSpace, usedSpace } = await statsForUser(userId);
	const userSizeDesc = simplifiedByteCount(usedSpace);
	const maxSpacDesc = simplifiedByteCount(maxSpacePerUser);
	console.debug(`User ${userId} has used ${userSizeDesc} of ${maxSpacDesc}`);

	// When done, get back to the caller with new stats
	respondSuccess(res, { totalSpace, usedSpace });
}
