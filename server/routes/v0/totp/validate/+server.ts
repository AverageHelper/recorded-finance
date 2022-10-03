import type { Request, Response } from "express";
import { BadRequestError, ConflictError, UnauthorizedError } from "../../../../errors/index.js";
import { generateSecret, generateTOTPSecretURI, verifyTOTP } from "../../../../auth/totp.js";
import { generateSecureToken } from "../../../../auth/generators.js";
import { metadataFromRequest } from "../../../../auth/requireAuth.js";
import { newAccessToken } from "../../../../auth/jwt.js";
import { respondSuccess } from "../../../../responses.js";
import { statsForUser, upsertUser } from "../../../../database/io.js";
import safeCompare from "safe-compare";
import { is, nonempty, string, type } from "superstruct";

export async function POST(req: Request, res: Response): Promise<void> {
	const reqBody = type({
		token: nonempty(string()),
	});

	// ** Check that the given TOTP is valid for the user. If valid, but the user hasn't yet enabled a 2FA requirement, enable it

	// Get credentials
	const { user } = await metadataFromRequest(req);
	const uid = user.uid;

	if (!is(req.body, reqBody)) {
		throw new BadRequestError("Improper parameter types");
	}
	const token = req.body.token;

	// If the user doesn't have a secret stored, return 409
	if (user.totpSeed === null || user.totpSeed === undefined || !user.totpSeed) {
		throw new ConflictError(
			"totp-secret-missing",
			"You do not have a TOTP secret to validate against"
		);
	}
	const secret = generateTOTPSecretURI(user.currentAccountId, user.totpSeed);

	// Check the TOTP is valid
	const isValid = verifyTOTP(token, secret);
	if (!isValid && typeof user.mfaRecoverySeed === "string") {
		// Check that the value is the user's recovery token
		const mfaRecoveryToken = generateSecret(user.mfaRecoverySeed);
		if (!safeCompare(token, mfaRecoveryToken)) {
			throw new UnauthorizedError("wrong-mfa-credentials");
		} else {
			// Invalidate the old token
			await upsertUser({
				currentAccountId: user.currentAccountId,
				mfaRecoverySeed: null, // TODO: Should we regenerate this?
				passwordHash: user.passwordHash,
				passwordSalt: user.passwordSalt,
				requiredAddtlAuth: user.requiredAddtlAuth ?? [],
				totpSeed: user.totpSeed,
				uid,
			});
		}
	}

	// If there's a pending secret for the user, and the user hasn't enabled a requirement, enable it
	let recovery_token: string | null = null;
	if (user.requiredAddtlAuth?.includes("totp") !== true) {
		const mfaRecoverySeed = generateSecureToken(15);
		recovery_token = generateSecret(mfaRecoverySeed);
		await upsertUser({
			currentAccountId: user.currentAccountId,
			mfaRecoverySeed,
			passwordHash: user.passwordHash,
			passwordSalt: user.passwordSalt,
			requiredAddtlAuth: ["totp"], // TODO: Leave other 2FA alone
			totpSeed: user.totpSeed,
			uid,
		});
	}

	const access_token = await newAccessToken(req, user, ["totp"]);
	const { totalSpace, usedSpace } = await statsForUser(uid);
	if (recovery_token !== null) {
		respondSuccess(res, { access_token, recovery_token, uid, totalSpace, usedSpace });
	} else {
		respondSuccess(res, { access_token, uid, totalSpace, usedSpace });
	}
}
