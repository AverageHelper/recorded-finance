import type { MFAOption, User } from "../database/schemas.js";
import { addJwtToBlacklist, jwtTokenFromRequest, newAccessToken } from "./jwt.js";
import { asyncWrapper } from "../asyncWrapper.js";
import { compare } from "bcrypt";
import { Context } from "./Context.js";
import { generateHash, generateSalt } from "./generators.js";
import { generateTOTPSecret, verifyTOTP } from "./totp.js";
import { MAX_USERS } from "./limits.js";
import { metadataFromRequest } from "./requireAuth.js";
import { respondSuccess } from "../responses.js";
import { Router } from "express";
import { throttle } from "./throttle.js";
import { v4 as uuid } from "uuid";
import {
	BadRequestError,
	ConflictError,
	DuplicateAccountError,
	NotEnoughRoomError,
	UnauthorizedError,
} from "../errors/index.js";
import {
	destroyUser,
	findUserWithProperties,
	numberOfUsers,
	statsForUser,
	upsertUser,
} from "../database/io.js";

// TODO: Implement WebAuthn (and test passkey support!)

interface ReqBody {
	account?: unknown;
	newaccount?: unknown;
	password?: unknown;
	newpassword?: unknown;
	token?: unknown;
}

async function userWithAccountId(accountId: string): Promise<User | null> {
	// Find first user whose account ID matches
	// TODO: Rename `currentAccountId` to `accountId`
	return await findUserWithProperties({ currentAccountId: accountId });
}

/**
 * Returns a fresh document ID that is virtually guaranteed
 * not to have been used before.
 */
function newDocumentId(): string {
	return uuid().replace(/-/gu, ""); // remove hyphens
}

/**
 * Routes and middleware for a basic authentication flow. Installs a
 * `context` property on the request object that includes the caller's
 * authorized user ID.
 *
 * @see https://thecodebarbarian.com/oauth-with-node-js-and-express.html
 */
export function auth(): Router {
	return Router()
		.post<unknown, unknown, ReqBody>(
			"/join",
			throttle(),
			asyncWrapper(async (req, res) => {
				const givenAccountId = req.body.account;
				const givenPassword = req.body.password;
				if (typeof givenAccountId !== "string" || typeof givenPassword !== "string") {
					throw new BadRequestError("Improper parameter types");
				}

				// ** Make sure we arent' full
				const limit = MAX_USERS;
				const current = await numberOfUsers();
				if (current >= limit)
					throw new NotEnoughRoomError("We're full at the moment. Try again later!");

				// ** Check credentials are unused
				const storedUser = await userWithAccountId(givenAccountId);
				if (storedUser) {
					throw new DuplicateAccountError();
				}

				// ** Store credentials
				const passwordSalt = await generateSalt();
				const passwordHash = await generateHash(givenPassword, passwordSalt);
				const uid = newDocumentId();
				const user: User = {
					uid,
					currentAccountId: givenAccountId,
					passwordHash,
					passwordSalt,
				};
				await upsertUser(user);

				// ** Generate an auth token and send it along
				const access_token = await newAccessToken(req, user, []);
				const { totalSpace, usedSpace } = await statsForUser(user.uid);
				respondSuccess(res, { access_token, uid, totalSpace, usedSpace });
			})
		)
		.post<unknown, unknown, ReqBody>(
			"/login",
			throttle(),
			asyncWrapper(async (req, res) => {
				// ** Create a JWT for the caller to use later

				const givenAccountId = req.body.account;
				const givenPassword = req.body.password;
				if (
					typeof givenAccountId !== "string" ||
					typeof givenPassword !== "string" ||
					givenAccountId === "" ||
					givenPassword === ""
				) {
					throw new BadRequestError("Improper parameter types");
				}

				// ** Get credentials
				const user = await userWithAccountId(givenAccountId);
				if (!user) {
					console.debug(`Found no user under account ${JSON.stringify(givenAccountId)}`);
					throw new UnauthorizedError("wrong-credentials");
				}

				// ** Verify credentials
				const isPasswordGood = await compare(givenPassword, user.passwordHash);
				if (!isPasswordGood) {
					console.debug(`The given password doesn't match what's stored`);
					throw new UnauthorizedError("wrong-credentials");
				}

				// ** If the user's account has a TOTP secret set and locked-in, validate="totp"
				const validate: MFAOption | "none" =
					(user.totpSecret ?? "") && // has a secret
					user.requiredAddtlAuth?.includes("totp") === true // totp enabled
						? "totp"
						: "none";

				// ** Generate an auth token and send it along
				const access_token = await newAccessToken(req, user, []);
				const uid = user.uid;
				const { totalSpace, usedSpace } = await statsForUser(uid);
				respondSuccess(res, { access_token, validate, uid, totalSpace, usedSpace });
			})
		)
		.get(
			"/totp/secret",
			asyncWrapper(async (req, res) => {
				// ** TOTP Registration

				const { user, validatedWithMfa } = await metadataFromRequest(req);
				const uid = user.uid;
				const accountId = user.currentAccountId;

				if (
					validatedWithMfa.includes("totp") ||
					user.requiredAddtlAuth?.includes("totp") === true
				) {
					// We definitely have a secret, the user used it to get here!
					// Or the user already has TOTP enabled.
					// Either way, we should not regenerate the token. Throw a 409:
					throw new ConflictError("totp-conflict", "You already have TOTP authentication enabled");
				}

				// Generate and store the new secret
				const secret = await generateTOTPSecret(accountId);

				// We should not lock in the secret until the user hits /totp/validate with that secret.
				// Just set the secret, not the 2fa requirement
				await upsertUser({
					currentAccountId: accountId,
					passwordHash: user.passwordHash,
					passwordSalt: user.passwordSalt,
					requiredAddtlAuth: [], // TODO: Leave other 2FA alone
					totpSecret: secret,
					uid,
				});

				respondSuccess(res, { secret });
			})
		)
		.delete(
			"/totp/secret",
			asyncWrapper<unknown, unknown, ReqBody>(async (req, res) => {
				// ** TOTP Un-registration

				const { user /* validatedWithMfa */ } = await metadataFromRequest(req);
				const uid = user.uid;
				const accountId = user.currentAccountId;
				const secret = user.totpSecret;

				const givenPassword = req.body.password;
				const token = req.body.token;
				if (
					typeof givenPassword !== "string" ||
					typeof token !== "string" ||
					givenPassword === "" ||
					token === ""
				) {
					throw new BadRequestError("Improper parameter types");
				}

				// If the user has no secret, treat the secret as deleted and return 200
				if (secret === null || secret === undefined || !secret) {
					respondSuccess(res);
					return;
				}

				// Validate the user's passphrase
				const isPasswordGood = await compare(givenPassword, user.passwordHash);
				if (!isPasswordGood) {
					throw new UnauthorizedError("wrong-credentials");
				}

				// Re-validate TOTP
				const isCodeGood = verifyTOTP(token, secret);
				if (isCodeGood) {
					respondSuccess(res);
				} else {
					throw new UnauthorizedError("wrong-credentials");
				}

				// Delete the secret and disable 2FA
				await upsertUser({
					currentAccountId: accountId,
					passwordHash: user.passwordHash,
					passwordSalt: user.passwordSalt,
					requiredAddtlAuth: [], // TODO: Leave other 2FA alone
					totpSecret: null,
					uid,
				});

				// TODO: Re-issue an auth token with updated validatedWithMfa information
				respondSuccess(res);
			})
		)
		.post<unknown, unknown, ReqBody>(
			"/totp/validate",
			asyncWrapper(async (req, res) => {
				// ** Check that the given TOTP is valid for the user. If valid, but the user hasn't yet enabled a 2FA requirement, enable it

				// Get credentials
				const { user } = await metadataFromRequest(req);
				const uid = user.uid;
				const secret = user.totpSecret;

				const token = req.body.token;
				if (typeof token !== "string" || token === "") {
					throw new BadRequestError("Improper parameter types");
				}

				// If the user doesn't have a secret stored, return 409
				if (secret === null || secret === undefined || !secret) {
					throw new ConflictError(
						"totp-secret-missing",
						"You do not have a TOTP secret to validate against"
					);
				}

				// Check the TOTP is valid
				const isValid = verifyTOTP(token, secret);
				if (!isValid) throw new UnauthorizedError("wrong-credentials");

				// If there's a pending secret for the user, and the user hasn't enabled a requirement, enable it
				if (!user.requiredAddtlAuth || !user.requiredAddtlAuth.includes("totp")) {
					await upsertUser({
						currentAccountId: user.currentAccountId,
						passwordHash: user.passwordHash,
						passwordSalt: user.passwordSalt,
						requiredAddtlAuth: ["totp"], // TODO: Leave other 2FA alone
						totpSecret: secret,
						uid,
					});
				}

				const access_token = await newAccessToken(req, user, ["totp"]);
				const { totalSpace, usedSpace } = await statsForUser(uid);
				respondSuccess(res, { access_token, uid, totalSpace, usedSpace });
			})
		)
		.get(
			"/session",
			// TODO: don't print the error if the user has no access here
			// throttle(),
			asyncWrapper(async (req, res) => {
				// ** If the user has the cookie set, respond with a JWT for the user

				const metadata = await metadataFromRequest(req); // throws if bad

				const access_token = await newAccessToken(req, metadata.user, metadata.validatedWithMfa);
				const uid = metadata.user.uid;
				const account = metadata.user.currentAccountId;
				const { totalSpace, usedSpace } = await statsForUser(uid);
				respondSuccess(res, { account, access_token, uid, totalSpace, usedSpace });
			})
		)
		.post("/logout", throttle(), (req, res) => {
			const token = jwtTokenFromRequest(req);
			if (token === null) {
				return respondSuccess(res);
			}

			// ** Blacklist the JWT
			addJwtToBlacklist(token);

			req.session = null;
			respondSuccess(res);
		})
		.post<unknown, unknown, ReqBody>(
			"/leave",
			throttle(),
			asyncWrapper(async (req, res) => {
				// Ask for full credentials, so we aren't leaning on a repeatable token
				const givenAccountId = req.body.account;
				const givenPassword = req.body.password;
				if (
					typeof givenAccountId !== "string" ||
					typeof givenPassword !== "string" ||
					givenAccountId === "" ||
					givenPassword === ""
				) {
					throw new BadRequestError("Improper parameter types");
				}

				// ** Get credentials
				const storedUser = await userWithAccountId(givenAccountId);
				if (!storedUser) {
					throw new UnauthorizedError("wrong-credentials");
				}

				// ** Verify password credentials
				const isPasswordGood = await compare(givenPassword, storedUser.passwordHash);
				if (!isPasswordGood) {
					throw new UnauthorizedError("wrong-credentials");
				}

				// ** Verify MFA
				if (
					typeof storedUser.totpSecret === "string" &&
					storedUser.requiredAddtlAuth?.includes("totp") === true
				) {
					// TOTP is required
					const token = req.body.token;

					if (typeof token !== "string" || token === "")
						// TODO: Use a different code for missing MFA
						throw new UnauthorizedError("wrong-credentials");

					const isValid = verifyTOTP(token, storedUser.totpSecret);
					if (!isValid) throw new UnauthorizedError("wrong-credentials");
				}

				// ** Delete the user
				await destroyUser(storedUser.uid);

				respondSuccess(res);
			})
		)
		.post<unknown, unknown, ReqBody>(
			"/updatepassword",
			throttle(),
			asyncWrapper(async (req, res) => {
				// Ask for full credentials, so we aren't leaning on a repeatable token
				const givenAccountId = req.body.account;
				const givenPassword = req.body.password;
				const newGivenPassword = req.body.newpassword;
				if (
					typeof givenAccountId !== "string" ||
					typeof givenPassword !== "string" ||
					typeof newGivenPassword !== "string" ||
					givenAccountId === "" ||
					givenPassword === "" ||
					newGivenPassword === ""
				) {
					throw new BadRequestError("Improper parameter types");
				}

				// ** Get credentials
				const storedUser = await userWithAccountId(givenAccountId);
				if (!storedUser) {
					throw new UnauthorizedError("wrong-credentials");
				}

				// ** Verify old credentials
				const isPasswordGood = await compare(givenPassword, storedUser.passwordHash);
				if (!isPasswordGood) {
					throw new UnauthorizedError("wrong-credentials");
				}

				// ** Verify MFA
				if (
					typeof storedUser.totpSecret === "string" &&
					storedUser.requiredAddtlAuth?.includes("totp") === true
				) {
					// TOTP is required
					const token = req.body.token;

					if (typeof token !== "string" || token === "")
						// TODO: Use a different code for missing MFA
						throw new UnauthorizedError("wrong-credentials");

					const isValid = verifyTOTP(token, storedUser.totpSecret);
					if (!isValid) throw new UnauthorizedError("wrong-credentials");
				}

				// ** Store new credentials
				const passwordSalt = await generateSalt();
				const passwordHash = await generateHash(newGivenPassword, passwordSalt);
				await upsertUser({
					uid: storedUser.uid,
					currentAccountId: storedUser.currentAccountId,
					passwordHash,
					passwordSalt,
				});

				// TODO: Invalidate the old jwt, send a new one
				respondSuccess(res);
			})
		)
		.post<unknown, unknown, ReqBody>(
			"/updateaccountid",
			throttle(),
			asyncWrapper(async (req, res) => {
				// Ask for full credentials, so we aren't leaning on a repeatable token
				const givenAccountId = req.body.account;
				const newGivenAccountId = req.body.newaccount;
				const givenPassword = req.body.password;
				if (
					typeof givenAccountId !== "string" ||
					typeof newGivenAccountId !== "string" ||
					typeof givenPassword !== "string" ||
					givenAccountId === "" ||
					newGivenAccountId === "" ||
					givenPassword === ""
				) {
					throw new BadRequestError("Improper parameter types");
				}

				// ** Get credentials
				const storedUser = await userWithAccountId(givenAccountId);
				if (!storedUser) {
					throw new UnauthorizedError("wrong-credentials");
				}

				// ** Verify old credentials
				const isPasswordGood = await compare(givenPassword, storedUser.passwordHash);
				if (!isPasswordGood) {
					throw new UnauthorizedError("wrong-credentials");
				}

				// ** Verify MFA
				if (
					typeof storedUser.totpSecret === "string" &&
					storedUser.requiredAddtlAuth?.includes("totp") === true
				) {
					// TOTP is required
					const token = req.body.token;

					if (typeof token !== "string" || token === "")
						// TODO: Use a different code for missing MFA
						throw new UnauthorizedError("wrong-credentials");

					const isValid = verifyTOTP(token, storedUser.totpSecret);
					if (!isValid) throw new UnauthorizedError("wrong-credentials");
				}

				// ** Store new credentials
				await upsertUser({
					uid: storedUser.uid,
					passwordHash: storedUser.passwordHash,
					passwordSalt: storedUser.passwordSalt,
					currentAccountId: newGivenAccountId,
				});

				// TODO: Invalidate the old jwt, send a new one
				respondSuccess(res);
			})
		);
}

export { Context };
export * from "./ownersOnly.js";
export * from "./requireAuth.js";
export * from "./limits.js";
