import type { TOTPSecretUri } from "../../../../auth/totp";
import { apiHandler, dispatchRequests } from "../../../../helpers/apiHandler";
import { BadRequestError } from "../../../../errors/BadRequestError";
import { ConflictError } from "../../../../errors/ConflictError";
import { generateSecret, generateTOTPSecretURI, verifyTOTP } from "../../../../auth/totp";
import { generateSecureToken } from "../../../../auth/generators";
import { is, type } from "superstruct";
import { metadataFromRequest } from "../../../../auth/requireAuth";
import { newAccessTokens, setSession } from "../../../../auth/jwt";
import { respondSuccess } from "../../../../responses";
import { statsForUser } from "../../../../database/read";
import { totpToken } from "../../../../database/schemas";
import { UnauthorizedError } from "../../../../errors/UnauthorizedError";
import { upsertUser } from "../../../../database/write";
import safeCompare from "safe-compare";

export const POST = apiHandler("POST", async (req, res) => {
	const reqBody = type({
		token: totpToken,
	});

	if (!is(req.body, reqBody)) {
		throw new BadRequestError("Improper parameter types");
	}
	const token = req.body.token;

	// ** Check that the given TOTP is valid for the user. If valid, but the user hasn't yet enabled a 2FA requirement, enable it

	// Get credentials
	const { user } = await metadataFromRequest(req, res);
	const uid = user.uid;

	// If the user doesn't have a secret stored, return 409
	if (user.totpSeed === null || user.totpSeed === undefined) {
		throw new ConflictError(
			"totp-secret-missing",
			"You do not have a TOTP secret to validate against"
		);
	}
	const secret = generateTOTPSecretURI(user.currentAccountId, user.totpSeed);

	// Check the TOTP is valid
	const isValid = verifyTOTP(token, secret);
	// FIXME: This considers TOTP to always be valid if there is no recovery seed (like when the seed has been previously used). Change the API response such that TOTP is not even requested on login if there is no recovery seed.
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
				pubnubCipherKey: user.pubnubCipherKey,
				uid,
			});
		}
	}

	// If there's a pending secret for the user, and the user hasn't enabled a requirement, enable it
	let recovery_token: TOTPSecretUri | null = null;
	if (user.requiredAddtlAuth?.includes("totp") !== true) {
		const mfaRecoverySeed = generateSecureToken(15);
		recovery_token = generateSecret(mfaRecoverySeed);
		await upsertUser({
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
	const { access_token, pubnub_token } = await newAccessTokens(user, ["totp"]);
	const { totalSpace, usedSpace } = await statsForUser(uid);

	setSession(req, res, access_token);
	if (recovery_token !== null) {
		respondSuccess(res, {
			access_token,
			pubnub_cipher_key,
			pubnub_token,
			recovery_token,
			uid,
			totalSpace,
			usedSpace,
		});
	} else {
		respondSuccess(res, {
			access_token,
			pubnub_cipher_key,
			pubnub_token,
			uid,
			totalSpace,
			usedSpace,
		});
	}
});

export default dispatchRequests({ POST });
