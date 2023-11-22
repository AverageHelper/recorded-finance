import type { Context } from "hono";
import type { MFAOption, User } from "../database/schemas";
import { assert, StructError } from "superstruct";
import { BadRequestError } from "../errors/BadRequestError";
import { blacklistHasJwt, jwtFromRequest, verifyJwt } from "./jwt";
import { InternalError } from "../errors/InternalError";
import { logger } from "../logger";
import { jwtPayload } from "../database/schemas";
import { NotFoundError } from "../errors/NotFoundError";
import { timingSafeEqual } from "./generators";
import { UnauthorizedError } from "../errors/UnauthorizedError";
import { userWithUid } from "../database/read";
import _jwt from "jsonwebtoken";

// FIXME: Not sure why, but tests fail unless we do this:
const { JsonWebTokenError, TokenExpiredError } = _jwt;

interface Metadata {
	/** The user's auth data. */
	user: User;

	/** The MFA confirmations that the user has completed this session. */
	validatedWithMfa: Array<MFAOption>;
}

/**
 * Retrieves user metadata from the request headers and session cookies in the request.
 */
export async function metadataFromRequest(c: Context<Env>): Promise<Metadata> {
	const token = await jwtFromRequest(c);
	if (token === null) {
		logger.debug("Request has no JWT");
		throw new UnauthorizedError("missing-token");
	}
	if (await blacklistHasJwt(c, token)) {
		logger.debug("Request has a blacklisted JWT");
		throw new UnauthorizedError("expired-token");
	}

	const payload = await verifyJwt(c, token).catch((error: unknown) => {
		if (
			error instanceof JsonWebTokenError ||
			error instanceof TokenExpiredError ||
			error instanceof StructError ||
			error instanceof TypeError
		) {
			logger.debug("JWT failed to verify because:", error.message);
			throw new UnauthorizedError("expired-token");
		} else {
			logger.error("JWT failed to verify due to an unknown error:", error);
			throw new InternalError({ code: "unknown" });
		}
	});

	try {
		assert(payload, jwtPayload);
	} catch (error) {
		if (error instanceof StructError) {
			logger.debug(`JWT payload failed to verify: ${error.message}`);
		} else {
			logger.debug(`JWT payload failed to verify: ${JSON.stringify(error)}`);
		}
		throw new BadRequestError("Invalid JWT payload");
	}

	const uid = payload.uid;
	const validatedWithMfa = payload.validatedWithMfa;
	// TODO: If the JWT is more than x minutes old (but not expired), leave validatedWithMfa empty. This would ensure that sensitive operations require the user to re-validate

	// NOTE: We need a full user-fetch here so we know we're working with a real user.
	// You might be tempted to slim this down to just passing the UID through, but don't.
	const user = await userWithUid(c, uid);
	if (!user) throw new NotFoundError();

	return { user, validatedWithMfa };
}

/** Asserts that the calling user is authorized to access the requested resource. */
export async function requireAuth(c: Context<Env, ":uid">): Promise<User> {
	const { user, validatedWithMfa } = await metadataFromRequest(c);

	if (
		user.requiredAddtlAuth?.includes("totp") === true && // req totp
		!validatedWithMfa.includes("totp") // didn't use totp this session
	) {
		throw new UnauthorizedError("missing-token");
	}

	const uid = c.req.param("uid");
	if (!timingSafeEqual(uid, user.uid)) {
		throw new UnauthorizedError("not-owner");
	}

	return user;
}
