import type { JwtPayload, MFAOption, User } from "../database/schemas";
import { addJwtToDatabase, jwtExistsInDatabase } from "../database/io";
import { isJwtPayload } from "../database/schemas";
import { generateSecureToken } from "./generators";
import { ONE_HOUR } from "../constants/time";
import { requireEnv } from "../environment";
import Cookies from "cookies";
import jwt from "jsonwebtoken";
import Keygrip from "keygrip";

/** A special secret that only the server should ever know. */
export const persistentSecret = requireEnv("AUTH_SECRET");
const SESSION_COOKIE_NAME = "sessionToken";
const keys = new Keygrip([persistentSecret]);

/**
 * Ascertains whether the token exists in the blacklist. If so,
 * that token's value should be treated as expired.
 */
export async function blacklistHasJwt(token: string): Promise<boolean> {
	return await jwtExistsInDatabase(token);
}

/**
 * Adds the token to a list of tokens to treat as expired.
 */
export async function addJwtToBlacklist(token: string): Promise<void> {
	try {
		await verifyJwt(token);
		await addJwtToDatabase(token);
	} catch {
		// The token was expired or otherwise invalid. No need to blacklist
	}
}

// TODO: Regularly purge tokens from blacklist that are older than the max age

// TODO: Be smarter about session storage. See https://gist.github.com/soulmachine/b368ce7292ddd7f91c15accccc02b8df and https://expressjs.com/en/advanced/best-practice-security.html#use-cookies-securely
export async function newAccessToken(
	req: APIRequest,
	res: APIResponse,
	user: User,
	validatedWithMfa: Array<MFAOption>
): Promise<string> {
	const options: jwt.SignOptions = { expiresIn: "1h" };
	const payload: JwtPayload = {
		uid: user.uid,
		validatedWithMfa,
	};

	const token = await new Promise<string>((resolve, reject) => {
		jwt.sign(payload, persistentSecret, options, (err, token) => {
			if (err) {
				reject(err);
				return;
			}
			if (token !== undefined) {
				resolve(token);
				return;
			}
			const error = new TypeError(
				`Failed to create JWT for user ${user.uid}: Both error and token parameters were empty.`
			);
			reject(error);
		});
	});

	const cookies = new Cookies(req, res, { keys });
	cookies.set(SESSION_COOKIE_NAME, token, {
		maxAge: ONE_HOUR,
		path: "/v0",
		sameSite: "strict",
		httpOnly: true,
		signed: true,
		overwrite: true,
		// secure: true, if the requester is HTTPS
	});

	return token;
}

/**
 * Revokes the cookies related to an authentication session.
 * The client may digress from standard behaviors and continue
 * sending the session cookies. You should blacklist and expire
 * the related session tokens as well, separately.
 */
export function killSession(req: APIRequest, res: APIResponse): void {
	const cookies = new Cookies(req, res, { keys });
	const twoHrsAgo = new Date(new Date().getTime() - 2 * ONE_HOUR);
	const gibberish = generateSecureToken(5);

	// Browsers are supposed to get rid of the cookie if `Expires`
	// is set in the past or `Max-Age` is zero or negative. We do
	// both, and set the value to gibberish. If a user agent doesn't
	// get rid of the cookie, that's fine, because the token goes
	// into a blacklist anyway. (See https://stackoverflow.com/a/53573622)
	cookies.set(SESSION_COOKIE_NAME, gibberish, {
		expires: twoHrsAgo,
		maxAge: -1,
		path: "/v0",
		sameSite: "strict",
		httpOnly: true,
		signed: true,
		overwrite: true,
		// secure: true, if the requester is HTTPS
	});
}

/**
 * Returns the raw JWT from the request's headers. Does **NOT** verify
 * the integrity of the token. Please call {@link verifyJwt} for that.
 *
 * Checks the `Cookie` header for the token. If no data is found there,
 * then we check the `Authorization` header for a "Bearer" token.
 */
export function jwtTokenFromRequest(req: APIRequest, res: APIResponse): string | null {
	// Get session token from cookies, if it exists
	const cookies = new Cookies(req, res, { keys });
	const token = cookies.get(SESSION_COOKIE_NAME, { signed: true }) ?? "";
	if (token) {
		return token;
	}

	// No cookies? Check auth header instead
	const authHeader = req.headers.authorization;
	const tokenParts = authHeader?.split(" ") ?? [];
	if (tokenParts[0] === "Bearer") {
		return (tokenParts[1] ?? "") || null;
	}
	return null;
}

export async function verifyJwt(token: string): Promise<jwt.JwtPayload> {
	return await new Promise<jwt.JwtPayload>((resolve, reject) => {
		jwt.verify(token, persistentSecret, (err, payload) => {
			// Fail if failed i guess
			if (err) return reject(err);

			// Check payload contents
			if (payload !== undefined) {
				if (!isJwtPayload(payload))
					return reject(new TypeError(`Malformed JWT: ${JSON.stringify(payload)}`));

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
