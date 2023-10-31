import { apiHandler } from "../../../helpers/apiHandler";
import { compare, generateHash, generateSalt } from "../../../auth/generators";
import { generateTOTPSecretURI, verifyTOTP } from "../../../auth/totp";
import { nonempty, optional, string, type } from "superstruct";
import { successResponse } from "../../../responses";
import { totpToken } from "../../../database/schemas";
import { UnauthorizedError } from "../../../errors/UnauthorizedError";
import { upsertUser } from "../../../database/write";
import { userWithAccountId } from "../../../database/read";

const PATH = "/api/v0/updatepassword";
const reqBody = type({
	account: nonempty(string()),
	password: nonempty(string()),
	newpassword: nonempty(string()),
	token: optional(totpToken),
});

export const POST = apiHandler(PATH, "POST", reqBody, async c => {
	// Ask for full credentials, so we aren't leaning on a repeatable token
	const body = c.req.valid("json");
	const givenAccountId = body.account; // TODO: Get this from auth state instead
	const givenPassword = body.password;
	const newGivenPassword = body.newpassword;

	// Get credentials
	const storedUser = await userWithAccountId(c, givenAccountId);
	if (!storedUser) {
		throw new UnauthorizedError("wrong-credentials");
	}

	// Verify old credentials
	const isPasswordGood = await compare(givenPassword, storedUser.passwordHash);
	if (!isPasswordGood) {
		throw new UnauthorizedError("wrong-credentials");
	}

	// Verify MFA
	if (
		typeof storedUser.totpSeed === "string" &&
		storedUser.requiredAddtlAuth?.includes("totp") === true
	) {
		// TOTP is required
		const token = body.token;

		if (typeof token !== "string") throw new UnauthorizedError("missing-mfa-credentials");

		const secret = generateTOTPSecretURI(c, storedUser.currentAccountId, storedUser.totpSeed);
		const isValid = verifyTOTP(token, secret);
		if (!isValid) throw new UnauthorizedError("wrong-mfa-credentials");
	}

	// Store new credentials
	const passwordSalt = await generateSalt();
	const passwordHash = await generateHash(newGivenPassword, passwordSalt);
	await upsertUser(c, {
		currentAccountId: storedUser.currentAccountId,
		mfaRecoverySeed: storedUser.mfaRecoverySeed ?? null,
		passwordHash,
		passwordSalt,
		pubnubCipherKey: storedUser.pubnubCipherKey,
		requiredAddtlAuth: storedUser.requiredAddtlAuth ?? [],
		totpSeed: storedUser.totpSeed ?? null,
		uid: storedUser.uid,
	});

	// TODO: Invalidate the old jwt, send a new one
	return successResponse(c);
});
