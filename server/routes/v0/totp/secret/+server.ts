import type { Request, Response } from "express";
import { BadRequestError, ConflictError, UnauthorizedError } from "../../../../errors/index.js";
import { compare, generateSecureToken } from "../../../../auth/generators.js";
import { generateTOTPSecretURI, verifyTOTP } from "../../../../auth/totp.js";
import { is, nonempty, string, type } from "superstruct";
import { metadataFromRequest } from "../../../../auth/requireAuth.js";
import { respondSuccess } from "../../../../responses.js";
import { upsertUser } from "../../../../database/io.js";

// MARK: - GET

export async function GET(req: Request, res: Response): Promise<void> {
	// ** TOTP Registration

	const { user, validatedWithMfa } = await metadataFromRequest(req);
	const uid = user.uid;
	const accountId = user.currentAccountId;

	if (validatedWithMfa.includes("totp") || user.requiredAddtlAuth?.includes("totp") === true) {
		// We definitely have a secret, the user used it to get here!
		// Or the user already has TOTP enabled.
		// Either way, we should not regenerate the token. Throw a 409:
		throw new ConflictError("totp-conflict", "You already have TOTP authentication enabled");
	}

	// Generate and store the new secret
	const totpSeed = generateSecureToken(15);
	const secret = generateTOTPSecretURI(accountId, totpSeed);

	// We should not lock in the secret until the user hits /totp/validate with that secret.
	// Just set the secret, not the 2fa requirement
	await upsertUser({
		currentAccountId: accountId,
		mfaRecoverySeed: user.mfaRecoverySeed ?? null,
		passwordHash: user.passwordHash,
		passwordSalt: user.passwordSalt,
		requiredAddtlAuth: [], // TODO: Leave other 2FA alone
		totpSeed,
		uid,
	});

	respondSuccess(res, { secret });
}

// MARK: - DELETE

export async function DELETE(req: Request, res: Response): Promise<void> {
	const reqBody = type({
		password: nonempty(string()),
		token: nonempty(string()),
	});
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
