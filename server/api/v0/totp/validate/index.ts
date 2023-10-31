import type { TOTPSecretUri } from "../../../../auth/totp";
import { apiHandler } from "../../../../helpers/apiHandler";
import { ConflictError } from "../../../../errors/ConflictError";
import { generateSecret, generateTOTPSecretURI, verifyTOTP } from "../../../../auth/totp";
import { generateSecureToken, timingSafeEqual } from "../../../../auth/generators";
import { metadataFromRequest } from "../../../../auth/requireAuth";
import { newAccessTokens, setSession } from "../../../../auth/jwt";
import { statsForUser } from "../../../../database/read";
import { successResponse } from "../../../../responses";
import { totpToken } from "../../../../database/schemas";
import { type } from "superstruct";
import { UnauthorizedError } from "../../../../errors/UnauthorizedError";
import { upsertUser } from "../../../../database/write";

const PATH = "/api/v0/totp/validate";
const reqBody = type({
	token: totpToken,
});

export const POST = apiHandler(PATH, "POST", reqBody, async c => {
	const { token } = c.req.valid("json");

	// ** Check that the given TOTP is valid for the user. If valid, but the user hasn't yet enabled a 2FA requirement, enable it

	// Get credentials
	const { user } = await metadataFromRequest(c);
	const uid = user.uid;

	// If the user doesn't have a secret stored, return 409
	if (user.totpSeed === null || user.totpSeed === undefined) {
		throw new ConflictError(
			"totp-secret-missing",
			"You do not have a TOTP secret to validate against"
		);
	}
	const secret = generateTOTPSecretURI(c, user.currentAccountId, user.totpSeed);

	// Check the TOTP is valid
	const isValid = verifyTOTP(token, secret);
	// FIXME: This considers TOTP to always be valid if there is no recovery seed (like when the seed has been previously used). Change the API response such that TOTP is not even requested on login if there is no recovery seed.
	if (!isValid && typeof user.mfaRecoverySeed === "string") {
		// Check that the value is the user's recovery token
		const mfaRecoveryToken = generateSecret(c, user.mfaRecoverySeed);
		if (!timingSafeEqual(token, mfaRecoveryToken)) {
			throw new UnauthorizedError("wrong-mfa-credentials");
		} else {
			// Invalidate the old token
			await upsertUser(c, {
				currentAccountId: user.currentAccountId,
				mfaRecoverySeed: null, // TODO: Should we regenerate this?
				passwordHash: user.passwordHash,
				passwordSalt: user.passwordSalt,
				requiredAddtlAuth: user.requiredAddtlAuth ?? [],
				totpSeed: user.totpSeed,
				pubnubCipherKey: user.pubnubCipherKey,
				uid,
			});
		}
	}

	// If there's a pending secret for the user, and the user hasn't enabled a requirement, enable it
	let recovery_token: TOTPSecretUri | null = null;
	if (user.requiredAddtlAuth?.includes("totp") !== true) {
		const mfaRecoverySeed = generateSecureToken(15);
		recovery_token = generateSecret(c, mfaRecoverySeed);
		await upsertUser(c, {
			currentAccountId: user.currentAccountId,
			mfaRecoverySeed,
			pubnubCipherKey: user.pubnubCipherKey,
			passwordHash: user.passwordHash,
			passwordSalt: user.passwordSalt,
			requiredAddtlAuth: user.requiredAddtlAuth?.concat("totp") ?? [],
			totpSeed: user.totpSeed,
			uid,
		});
	}

	const pubnub_cipher_key = user.pubnubCipherKey;
	const { access_token, pubnub_token } = await newAccessTokens(c, user, ["totp"]);
	const { totalSpace, usedSpace } = await statsForUser(c, uid);

	await setSession(c, access_token);
	if (recovery_token !== null) {
		return successResponse(c, {
			access_token,
			pubnub_cipher_key,
			pubnub_token,
			recovery_token,
			uid,
			totalSpace,
			usedSpace,
		});
	}

	return successResponse(c, {
		access_token,
		pubnub_cipher_key,
		pubnub_token,
		uid,
		totalSpace,
		usedSpace,
	});
});
