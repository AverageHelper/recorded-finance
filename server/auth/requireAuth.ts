import type { JsonWebTokenError } from "jsonwebtoken";
import type { MFAOption, User } from "../database/schemas";
import { assertSchema, jwtPayload } from "../database/schemas";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../errors";
import { blacklistHasJwt, jwtFromRequest, verifyJwt } from "./jwt";
import { StructError } from "superstruct";
import { userWithUid } from "../database/io";

interface Metadata {
	/** The user's auth data. */
	user: User;

	/** The MFA confirmations that the user has completed this session. */
	validatedWithMfa: Array<MFAOption>;
}

/**
 * Retrieves user metadata from the request headers and session cookies in the request.
 */
export async function metadataFromRequest(req: APIRequest, res: APIResponse): Promise<Metadata> {
	const token = jwtFromRequest(req, res);
	if (token === null) {
		console.debug("Request has no JWT");
		throw new UnauthorizedError("missing-token");
	}
	if (await blacklistHasJwt(token)) {
		console.debug("Request has a blacklisted JWT");
		throw new UnauthorizedError("expired-token");
	}

	const payload = await verifyJwt(token).catch((error: JsonWebTokenError) => {
		console.debug(`JWT failed to verify because ${error.message}`);
		throw new UnauthorizedError("expired-token");
	});

	try {
		assertSchema(payload, jwtPayload);
	} catch (error) {
		if (error instanceof StructError) {
			console.debug(`JWT payload failed to verify: ${error.message}`);
		} else {
			console.debug(`JWT payload failed to verify: ${JSON.stringify(error)}`);
		}
		throw new BadRequestError("Invalid JWT payload");
	}

	const uid = payload.uid;
	const validatedWithMfa = payload.validatedWithMfa;
	// TODO: If the JWT is more than x minutes old (but not expired), leave validatedWithMfa empty. This would ensure that sensitive operations require the user to re-validate

	// NOTE: We need a full user-fetch here so we know we're working with a real user.
	// You might be tempted to slim this down to just passing the UID through, but don't.
	const user = await userWithUid(uid);
	if (!user) throw new NotFoundError();

	return { user, validatedWithMfa };
}

/** Asserts that the calling user is authorized to access the requested resource. */
export async function requireAuth(req: APIRequest, res: APIResponse): Promise<void> {
	const { user, validatedWithMfa } = await metadataFromRequest(req, res);

	if (
		user.requiredAddtlAuth?.includes("totp") === true && // req totp
		!validatedWithMfa.includes("totp") // didn't use totp this session
	) {
		throw new UnauthorizedError("missing-token");
	}
}
