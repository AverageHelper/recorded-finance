import type { Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "../../errors/index.js";
import { compare } from "../../auth/generators.js";
import { destroyUser, userWithAccountId } from "../../database/io.js";
import { generateTOTPSecretURI, verifyTOTP } from "../../auth/totp.js";
import { respondSuccess } from "../../responses.js";
import { is, nonempty, optional, string, type } from "superstruct";

const reqBody = type({
	account: nonempty(string()),
	password: nonempty(string()),
	token: optional(nonempty(string())),
});

export async function postLeave(req: Request, res: Response): Promise<void> {
	if (!is(req.body, reqBody)) {
		throw new BadRequestError("Improper parameter types");
	}

	// Ask for full credentials, so we aren't leaning on a repeatable token
	const givenAccountId = req.body.account;
	const givenPassword = req.body.password;

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
		typeof storedUser.totpSeed === "string" &&
		storedUser.requiredAddtlAuth?.includes("totp") === true
	) {
		// TOTP is required
		const token = req.body.token;

		if (typeof token !== "string" || token === "")
			throw new UnauthorizedError("missing-mfa-credentials");

		const secret = generateTOTPSecretURI(storedUser.currentAccountId, storedUser.totpSeed);
		const isValid = verifyTOTP(token, secret);
		if (!isValid) throw new UnauthorizedError("wrong-mfa-credentials");
	}

	// ** Delete the user
	await destroyUser(storedUser.uid);

	respondSuccess(res);
}
