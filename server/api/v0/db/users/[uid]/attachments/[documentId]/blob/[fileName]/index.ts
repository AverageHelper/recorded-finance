import type { Context } from "hono";
import type { UID } from "../../../../../../../../../database/schemas";
import { apiHandler, dispatchRequests } from "../../../../../../../../../helpers/apiHandler";
import { BadRequestError } from "../../../../../../../../../errors/BadRequestError";
import { dataResponse, successResponse } from "../../../../../../../../../responses";
import { destroyFileData, upsertFileData } from "../../../../../../../../../database/write";
import { fetchFileData, statsForUser } from "../../../../../../../../../database/read";
import { logger } from "../../../../../../../../../logger";
import { maxStorageSpacePerUser, MAX_FILE_BYTES } from "../../../../../../../../../auth/limits";
import { NotEnoughRoomError } from "../../../../../../../../../errors/NotEnoughRoomError";
import { NotFoundError } from "../../../../../../../../../errors/NotFoundError";
import { requireAuth } from "../../../../../../../../../auth/requireAuth";
import { sep as pathSeparator } from "node:path";
import { simplifiedByteCount } from "../../../../../../../../../transformers/simplifiedByteCount";

const PATH = "/api/v0/db/users/:uid/attachments/:documentId/blob/:fileName";

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
	// Make sure value doesn't contain a path separator.
	// Hono will likely treat a path value of `..` as the previous route position,
	// but good to make sure here too.
	if (value.includes(pathSeparator) || value.includes(".."))
		throw new BadRequestError(
			`${name} cannot contain a '${pathSeparator}' character or a parent directory marker`
		);

	return value.trim();
}

/**
 * Ensures that the appropriate parameters are present and valid file path segments.
 */
function requireFilePathParameters(
	c: Context<Env, typeof PATH>
): Required<{ uid: UID; documentId: string; fileName: string }> {
	const uid = c.req.param("uid");
	const documentId = c.req.param("documentId");
	const fileName = c.req.param("fileName");

	return {
		uid: assertPathSegment(uid, "uid"),
		documentId: assertPathSegment(documentId, "documentId"),
		fileName: assertPathSegment(fileName, "fileName"),
	};
}

export const GET = apiHandler(PATH, "GET", null, async c => {
	await requireAuth(c);
	const { uid: userId, fileName } = requireFilePathParameters(c);

	const file = await fetchFileData(c, userId, fileName);
	if (file === null) throw new NotFoundError();

	return dataResponse(c, {
		contents: file.contents.toString("utf8"),
		_id: fileName,
	});
});

export const POST = apiHandler(PATH, "POST", "form-data", async c => {
	await requireAuth(c);

	// TODO: When we move to Cloudflare, the `File` global will become available
	const upload = await c.req.parseBody<Record<string, string | Blob | Array<string | Blob>>>();
	const file = upload["file"];
	if (!file || Array.isArray(file)) throw new BadRequestError("You must include a file to store");

	// File must be under ~4.2 MB
	const fileContents =
		typeof file === "string" ? Buffer.from(file) : Buffer.from(await file.text());

	if (Buffer.byteLength(fileContents) > MAX_FILE_BYTES) {
		throw new BadRequestError("File is too large.");
	}

	const { uid: userId, fileName } = requireFilePathParameters(c);

	const { totalSpace, usedSpace } = await statsForUser(c, userId);
	const userSizeDesc = simplifiedByteCount(usedSpace);
	const maxSpacDesc = simplifiedByteCount(maxStorageSpacePerUser(c));
	logger.debug(`User ${userId} has used ${userSizeDesc} of ${maxSpacDesc}`);

	const remainingSpace = totalSpace - usedSpace;
	if (remainingSpace <= 0) throw new NotEnoughRoomError();

	const contents = fileContents; // this better be utf8
	await upsertFileData(c, { userId, fileName, contents });

	{
		const { totalSpace, usedSpace } = await statsForUser(c, userId);
		return successResponse(c, { totalSpace, usedSpace });
	}
});

export const DELETE = apiHandler(PATH, "DELETE", null, async c => {
	await requireAuth(c);
	const { uid: userId, fileName } = requireFilePathParameters(c);

	await destroyFileData(c, userId, fileName);

	// Report the user's new usage
	const { totalSpace, usedSpace } = await statsForUser(c, userId);
	const userSizeDesc = simplifiedByteCount(usedSpace);
	const maxSpacDesc = simplifiedByteCount(maxStorageSpacePerUser(c));
	logger.debug(`User ${userId} has used ${userSizeDesc} of ${maxSpacDesc}`);

	// When done, get back to the caller with new stats
	return successResponse(c, { totalSpace, usedSpace });
});

export default dispatchRequests(PATH, { GET, POST, DELETE });
