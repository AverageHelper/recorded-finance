import type { Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "../../../errors/index.js";
import { compare } from "../../../auth/generators.js";
import { generateTOTPSecretURI, verifyTOTP } from "../../../auth/totp.js";
import { metadataFromRequest } from "../../../auth/requireAuth.js";
import { respondSuccess } from "../../../responses.js";
import { upsertUser } from "../../../database/io.js";
import { is, nonempty, string, type } from "superstruct";

const reqBody = type({
	password: nonempty(string()),
	token: nonempty(string()),
});

export async function deleteTotpSecret(req: Request, res: Response): Promise<void> {
	if (!is(req.body, reqBody)) {
		throw new BadRequestError("Improper parameter types");
	}

	// ** TOTP Un-registration

	const { user /* validatedWithMfa */ } = await metadataFromRequest(req);
	const uid = user.uid;
	const accountId = user.currentAccountId;

	const givenPassword = req.body.password;
	const token = req.body.token;

	// If the user has no secret, treat the secret as deleted and return 200
	if (user.totpSeed === null || user.totpSeed === undefined || !user.totpSeed) {
		respondSuccess(res);
		return;
	}
	const secret = generateTOTPSecretURI(user.currentAccountId, user.totpSeed);

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
		throw new UnauthorizedError("wrong-mfa-credentials");
	}

	// Delete the secret and disable 2FA
	await upsertUser({
		currentAccountId: accountId,
		mfaRecoverySeed: user.mfaRecoverySeed ?? null,
		passwordHash: user.passwordHash,
		passwordSalt: user.passwordSalt,
		requiredAddtlAuth: [], // TODO: Leave other 2FA alone
		totpSeed: null,
		uid,
	});

	// TODO: Re-issue an auth token with updated validatedWithMfa information
	respondSuccess(res);
}
