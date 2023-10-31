import type { Context } from "hono";
import type { CookieOptions } from "hono/utils/cookie";
import type { JwtPayload, MFAOption, PubNubToken, User } from "../database/schemas";
import type { Opaque, ReadonlyDeep } from "type-fest";
import type { SignOptions } from "jsonwebtoken";
import { addJwtToDatabase } from "../database/write";
import { assertJwtPayload } from "../database/schemas";
import { getSignedCookie, setCookie, setSignedCookie } from "hono/cookie";
import { env, requireEnv } from "../environment";
import { generateSecureToken } from "./generators";
import { jwtExistsInDatabase } from "../database/read";
import { newPubNubTokenForUser, revokePubNubToken } from "./pubnub";
import { ONE_HOUR } from "../constants/time";
import _jwt from "jsonwebtoken";

// FIXME: Not sure why, but tests fail unless we do this:
const { sign: _signJwt, verify: _verifyJwt } = _jwt;

/** A special secret that only the server should ever know. */
export function persistentSecret(c: Pick<Context<Env>, "env">): string {
	return requireEnv(c, "AUTH_SECRET");
}
const SESSION_COOKIE_NAME = "sessionToken";

export type JWT = Opaque<string, "JWT">;

/**
 * Ascertains whether the token exists in the blacklist. If so,
 * that token's value should be treated as expired.
 */
export async function blacklistHasJwt(c: Context<Env>, token: JWT): Promise<boolean> {
	return await jwtExistsInDatabase(c, token);
}

/**
 * Adds the token to a list of tokens to treat as expired.
 */
export async function addJwtToBlacklist(c: Context<Env>, token: JWT): Promise<void> {
	try {
		const payload = await verifyJwt(c, token);
		await revokePubNubToken(c, payload.pubnubToken, payload.uid);
		await addJwtToDatabase(c, token);
	} catch {
		// The token was expired or otherwise invalid. No need to blacklist
	}
}

// TODO: Regularly purge tokens from blacklist that are older than the max age

// TODO: Be smarter about session storage. See https://gist.github.com/soulmachine/b368ce7292ddd7f91c15accccc02b8df and https://expressjs.com/en/advanced/best-practice-security.html#use-cookies-securely

interface AccessTokens {
	/**
	 * A token that permits access to the user's data.
	 */
	access_token: string;

	/**
	 * A token that permits the user to subscribe to data change notifications via PubNub.
	 */
	pubnub_token: PubNubToken;
}

/**
 * Creates a new set of access tokens for the given user and 2FA metadata.
 * These tokens are valid for about an hour after creation.
 *
 * - The `access_token` should be sent to the client using {@link setSession}.
 * - The `pubnub_token` should be sent to the client directly in a response body.
 */
export async function newAccessTokens(
	c: Context<Env>,
	user: User,
	validatedWithMfa: ReadonlyArray<MFAOption>
): Promise<AccessTokens> {
	const options: SignOptions = { expiresIn: "1h" };
	const payload: ReadonlyDeep<JwtPayload> = {
		pubnubToken: await newPubNubTokenForUser(c, user),
		uid: user.uid,
		validatedWithMfa,
	};

	return {
		access_token: await createJwt(c, payload, options),
		pubnub_token: payload.pubnubToken,
	};
}

/**
 * Sets the session cookie with the given value, or revokes the cookie if the value is `null`.
 */
export async function setSession(c: Context<Env>, value: string | null): Promise<void> {
	let domain = env(c, "HOST") ?? env(c, "VERCEL_URL") ?? "";
	if (!domain) {
		throw new TypeError("Missing value for environment keys HOST and VERCEL_URL");
	}

	// Strip protocol
	if (domain.startsWith("https://")) {
		domain = domain.slice(8);
	} else if (domain.startsWith("http://")) {
		domain = domain.slice(7);
	}

	// Strip port
	domain = domain.split(":")[0] ?? "";

	const signingSecret = persistentSecret(c);

	const opts: CookieOptions = {
		domain,
		httpOnly: true,
		maxAge: ONE_HOUR,
		path: "/",
		sameSite: "Strict",
		secure: true,
		signingSecret,
	};

	if (value === null) {
		// Ask the client to revoke the session cookies.
		// Browsers are supposed to get rid of the cookie if `Expires`
		// is set in the past or `Max-Age` is zero or negative. We do
		// both, and set the value to gibberish. If a user agent doesn't
		// get rid of the cookie, that's fine, because the token should go
		// into a blacklist anyway. (See https://stackoverflow.com/a/53573622)
		const gibberish = generateSecureToken(5);
		const twoHrsAgo = new Date(new Date().getTime() - 2 * ONE_HOUR);
		opts.maxAge = -1;
		opts.expires = twoHrsAgo;
		setCookie(c, SESSION_COOKIE_NAME, gibberish, opts);
	} else {
		// Set session cookies
		await setSignedCookie(c, SESSION_COOKIE_NAME, value, signingSecret, opts);
	}
}

/**
 * Revokes the cookies related to an authentication session.
 * The client may digress from standard behaviors and continue
 * sending the session cookies. You should blacklist and expire
 * the related session tokens as well, separately.
 */
export async function killSession(c: Context<Env>): Promise<void> {
	await setSession(c, null);
}

/**
 * Returns the raw JWT from the request's headers. Does **NOT** verify
 * the integrity of the token. Please call {@link verifyJwt} for that.
 *
 * Checks the `Cookie` header for the token. If no data is found there,
 * then we check the `Authorization` header for a "Bearer" token.
 */
export async function jwtFromRequest(c: Context<Env>): Promise<JWT | null> {
	// Get session token from cookies, if it exists
	// const cookies = new Cookies(req, res, { keys, secure: true });
	const token = (await getSignedCookie(c, persistentSecret(c), SESSION_COOKIE_NAME)) ?? false;
	if (token !== false) {
		return token as JWT;
	}

	// No cookies? Check auth header instead
	const authHeader = c.req.header("authorization");
	const tokenParts = authHeader?.split(" ") ?? [];
	if (tokenParts[0] === "Bearer") {
		const token = tokenParts[1] ?? "";
		if (token === "") return null;
		return token as JWT;
	}
	return null;
}

export async function verifyJwt(c: Context<Env>, token: JWT): Promise<JwtPayload> {
	return await new Promise<JwtPayload>((resolve, reject) => {
		_verifyJwt(token, persistentSecret(c), (err, payload) => {
			// Fail if failed i guess
			if (err) return reject(err); // TODO: Something safer than a `reject`, since we always know what kind of error this is

			// Check payload contents
			if (payload !== undefined) {
				try {
					assertJwtPayload(payload);
				} catch (error) {
					return reject(error);
				}

				// Parameters are valid!
				return resolve(payload);
			}

			// Sanity check. We should never get here.
			const error = new TypeError(
				"Failed to verify JWT: Both error and payload parameters were empty."
			);
			return reject(error);
		});
	});
}

async function createJwt(
	c: Context<Env>,
	payload: ReadonlyDeep<JwtPayload>,
	options: SignOptions
): Promise<string> {
	return await new Promise<string>((resolve, reject) => {
		_signJwt(payload, persistentSecret(c), options, (err, token) => {
			if (err) {
				reject(err);
				return;
			}
			if (token !== undefined) {
				resolve(token);
				return;
			}
			const error = new TypeError(
				`Failed to create JWT for user ${payload.uid}: Both error and token parameters were empty.`
			);
			reject(error);
		});
	});
}
