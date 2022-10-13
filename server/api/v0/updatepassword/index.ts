import { apiHandler, dispatchRequests } from "../../../helpers/apiHandler";
import { BadRequestError } from "../../../errors/BadRequestError";
import { compare, generateHash, generateSalt } from "../../../auth/generators";
import { generateTOTPSecretURI, verifyTOTP } from "../../../auth/totp";
import { is, nonempty, optional, string, type } from "superstruct";
import { respondSuccess } from "../../../responses";
import { UnauthorizedError } from "../../../errors/UnauthorizedError";
import { upsertUser, userWithAccountId } from "../../../database/io";

export const POST = apiHandler("POST", async (req, res) => {
	const reqBody = type({
		account: nonempty(string()),
		password: nonempty(string()),
		newpassword: nonempty(string()),
		token: optional(nonempty(string())),
	});

	if (!is(req.body, reqBody)) {
		throw new BadRequestError("Improper parameter types");
	}

	// Ask for full credentials, so we aren't leaning on a repeatable token
	const givenAccountId = req.body.account;
	const givenPassword = req.body.password;
	const newGivenPassword = req.body.newpassword;

	// Get credentials
	const storedUser = await userWithAccountId(givenAccountId);
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
		const token = req.body.token;

		if (typeof token !== "string") throw new UnauthorizedError("missing-mfa-credentials");

		const secret = generateTOTPSecretURI(storedUser.currentAccountId, storedUser.totpSeed);
		const isValid = verifyTOTP(token, secret);
		if (!isValid) throw new UnauthorizedError("wrong-mfa-credentials");
	}

	// Store new credentials
	const passwordSalt = await generateSalt();
	const passwordHash = await generateHash(newGivenPassword, passwordSalt);
	await upsertUser({
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
	respondSuccess(res);
});

export default dispatchRequests({ POST });
