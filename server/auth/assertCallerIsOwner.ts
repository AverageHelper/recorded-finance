import { pathSegments } from "../helpers/pathSegments";
import { metadataFromRequest, requireAuth } from "./requireAuth";
import { UnauthorizedError } from "../errors";
import safeCompare from "tsscmp";

/**
 * Asserts that the request's `uid` param
 * matches the calling user's authorization token.
 *
 * Make sure the `requireAuth` handler has been called first, or
 * this handler will always throw an `UnauthorizedError`.
 */
export async function assertCallerIsOwner(req: APIRequest, res: APIResponse): Promise<void> {
	await requireAuth(req, res);
	const auth = (await metadataFromRequest(req, res).catch(() => null))?.user;
	const { uid } = pathSegments(req, "uid");

	if (!auth || !uid || !safeCompare(uid, auth.uid)) {
		throw new UnauthorizedError("not-owner");
	}
}
