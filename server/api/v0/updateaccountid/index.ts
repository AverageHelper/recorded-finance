import { apiHandler } from "../../../helpers/apiHandler";
import { compare } from "../../../auth/generators";
import { generateTOTPSecretURI, verifyTOTP } from "../../../auth/totp";
import { nonemptyLargeString, nonemptyString, totpToken } from "../../../database/schemas";
import { optional, type } from "superstruct";
import { successResponse } from "../../../responses";
import { UnauthorizedError } from "../../../errors/UnauthorizedError";
import { upsertUser } from "../../../database/write";
import { userWithAccountId } from "../../../database/read";

const PATH = "/api/v0/updateaccountid";
const reqBody = type({
	account: nonemptyString,
	newaccount: nonemptyString,
	password: nonemptyLargeString,
	token: optional(totpToken),
});

export const POST = apiHandler(PATH, "POST", reqBody, async c => {
	// Ask for full credentials, so we aren't leaning on a repeatable token
	const body = c.req.valid("json");
	const givenAccountId = body.account; // TODO: Get this from auth state instead
	const newGivenAccountId = body.newaccount;
	const givenPassword = body.password;

	// ** Get credentials
	const storedUser = await userWithAccountId(c, givenAccountId);
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
		typeof storedUser.totpSeed === "string" &&
		storedUser.requiredAddtlAuth?.includes("totp") === true
	) {
		// TOTP is required
		const token = body.token;

		if (typeof token !== "string" || token === "")
			throw new UnauthorizedError("missing-mfa-credentials");

		const secret = generateTOTPSecretURI(c, storedUser.currentAccountId, storedUser.totpSeed);
		const isValid = verifyTOTP(token, secret);
		if (!isValid) throw new UnauthorizedError("wrong-mfa-credentials");
	}

	// ** Store new credentials
	await upsertUser(c, {
		currentAccountId: newGivenAccountId,
		mfaRecoverySeed: storedUser.mfaRecoverySeed ?? null,
		passwordHash: storedUser.passwordHash,
		passwordSalt: storedUser.passwordSalt,
		pubnubCipherKey: storedUser.pubnubCipherKey,
		requiredAddtlAuth: storedUser.requiredAddtlAuth ?? [],
		totpSeed: storedUser.totpSeed ?? null,
		uid: storedUser.uid,
	});

	// TODO: Invalidate the old jwt, send a new one
	return successResponse(c);
});
