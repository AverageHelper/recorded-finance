import type { JwtPayload, MFAOption, PubNubToken, TOTPToken, User } from "../database/schemas";
import type { ReadonlyDeep } from "type-fest";
import type { SignOptions } from "jsonwebtoken";
import { addJwtToDatabase } from "../database/write";
import { assertJwtPayload, isTotpToken } from "../database/schemas";
import { env, requireEnv } from "../environment";
import { generateSecureToken } from "./generators";
import { jwtExistsInDatabase } from "../database/read";
import { newPubNubTokenForUser, revokePubNubToken } from "./pubnub";
import { ONE_HOUR } from "../constants/time";
import _jwt from "jsonwebtoken";
import Cookies from "cookies";
import Keygrip from "keygrip";

// FIXME: Not sure why, but tests fail unless we do this:
const { sign: _signJwt, verify: _verifyJwt } = _jwt;

/** A special secret that only the server should ever know. */
export const persistentSecret = requireEnv("AUTH_SECRET");
const SESSION_COOKIE_NAME = "sessionToken";
const keys = new Keygrip([persistentSecret]);

/**
 * Ascertains whether the token exists in the blacklist. If so,
 * that token's value should be treated as expired.
 */
export async function blacklistHasJwt(token: TOTPToken): Promise<boolean> {
	return await jwtExistsInDatabase(token);
}

/**
 * Adds the token to a list of tokens to treat as expired.
 */
export async function addJwtToBlacklist(token: TOTPToken): Promise<void> {
	try {
		const payload = await verifyJwt(token);
		await revokePubNubToken(payload.pubnubToken, payload.uid);
		await addJwtToDatabase(token);
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
	user: User,
	validatedWithMfa: ReadonlyArray<MFAOption>
): Promise<AccessTokens> {
	const options: SignOptions = { expiresIn: "1h" };
	const payload: ReadonlyDeep<JwtPayload> = {
		pubnubToken: await newPubNubTokenForUser(user),
		uid: user.uid,
		validatedWithMfa,
	};

	return {
		access_token: await createJwt(payload, options),
		pubnub_token: payload.pubnubToken,
	};
}

/**
 * Sets the session cookie with the given value, or revokes the cookie if the value is `null`.
 */
export function setSession(req: APIRequest, res: APIResponse, value: string | null): void {
	const cookies = new Cookies(req, res, { keys, secure: true });
	let domain = env("HOST") ?? env("VERCEL_URL") ?? "";
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

	const opts: Cookies.SetOption = {
		maxAge: ONE_HOUR,
		domain,
		path: "/",
		sameSite: "strict",
		httpOnly: true,
		secure: true,
		signed: true,
		overwrite: true,
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
		cookies.set(SESSION_COOKIE_NAME, gibberish, opts);
	} else {
		// Set session cookies
		cookies.set(SESSION_COOKIE_NAME, value, opts);
	}
}

/**
 * Revokes the cookies related to an authentication session.
 * The client may digress from standard behaviors and continue
 * sending the session cookies. You should blacklist and expire
 * the related session tokens as well, separately.
 */
export function killSession(req: APIRequest, res: APIResponse): void {
	setSession(req, res, null);
}

/**
 * Returns the raw JWT from the request's headers. Does **NOT** verify
 * the integrity of the token. Please call {@link verifyJwt} for that.
 *
 * Checks the `Cookie` header for the token. If no data is found there,
 * then we check the `Authorization` header for a "Bearer" token.
 */
export function jwtFromRequest(req: APIRequest, res: APIResponse): TOTPToken | null {
	// Get session token from cookies, if it exists
	const cookies = new Cookies(req, res, { keys, secure: true });
	const token = cookies.get(SESSION_COOKIE_NAME, { signed: true }) ?? "";
	if (isTotpToken(token)) {
		return token;
	}

	// No cookies? Check auth header instead
	const authHeader = req.headers.authorization;
	const tokenParts = authHeader?.split(" ") ?? [];
	if (tokenParts[0] === "Bearer") {
		const token = tokenParts[1];
		if (!isTotpToken(token)) return null;
		return token;
	}
	return null;
}

export async function verifyJwt(token: TOTPToken): Promise<JwtPayload> {
	return await new Promise<JwtPayload>((resolve, reject) => {
		_verifyJwt(token, persistentSecret, (err, payload) => {
			// Fail if failed i guess
			if (err) return reject(err);

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

async function createJwt(payload: ReadonlyDeep<JwtPayload>, options: SignOptions): Promise<string> {
	return await new Promise<string>((resolve, reject) => {
		_signJwt(payload, persistentSecret, options, (err, token) => {
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
