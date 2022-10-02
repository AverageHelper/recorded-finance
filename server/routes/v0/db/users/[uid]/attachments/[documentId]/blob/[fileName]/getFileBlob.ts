import type { DocumentData } from "../../../../../../../../../database/schemas.js";
import type { Params } from "./Params.js";
import type { Request, Response } from "express";
import { BadRequestError, NotFoundError } from "../../../../../../../../../errors/index.js";
import { fetchFileData } from "../../../../../../../../../database/io.js";
import { sep as pathSeparator } from "node:path";
import { respondData } from "../../../../../../../../../responses.js";

interface FileData {
	contents: string;
	_id: string;
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

export async function getFileBlob(req: Request<Params>, res: Response): Promise<void> {
	const { uid: userId, fileName } = requireFilePathParameters(req.params);

	const file = await fetchFileData(userId, fileName);
	if (file === null) throw new NotFoundError();

	const contents = file.contents.toString("utf8");
	const fileData: DocumentData<FileData> = {
		contents,
		_id: req.params.fileName,
	};
	respondData(res, fileData);
}
