import type { Request, Response } from "express";
import { ConflictError } from "../../../errors/index.js";
import { generateSecureToken } from "../../../auth/generators.js";
import { generateTOTPSecretURI } from "../../../auth/totp.js";
import { metadataFromRequest } from "../../../auth/requireAuth.js";
import { respondSuccess } from "../../../responses.js";
import { upsertUser } from "../../../database/io.js";

export async function getTotpSecret(req: Request, res: Response): Promise<void> {
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
