import { apiHandler, dispatchRequests } from "../../../../helpers/apiHandler";
import { BadRequestError } from "../../../../errors/BadRequestError";
import { ConflictError } from "../../../../errors/ConflictError";
import { compare, generateSecureToken } from "../../../../auth/generators";
import { generateTOTPSecretURI, verifyTOTP } from "../../../../auth/totp";
import { is, type } from "superstruct";
import { metadataFromRequest } from "../../../../auth/requireAuth";
import { respondSuccess } from "../../../../responses";
import { nonemptyLargeString, totpToken } from "../../../../database/schemas";
import { UnauthorizedError } from "../../../../errors/UnauthorizedError";
import { upsertUser } from "../../../../database/write";

export const GET = apiHandler("GET", async (req, res) => {
	// ** TOTP Registration

	const { user, validatedWithMfa } = await metadataFromRequest(req, res);
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
		pubnubCipherKey: user.pubnubCipherKey,
		requiredAddtlAuth: user.requiredAddtlAuth?.filter(t => t !== "totp") ?? [],
		totpSeed,
		uid,
	});

	respondSuccess(res, { secret });
});

export const DELETE = apiHandler("DELETE", async (req, res) => {
	const reqBody = type({
		password: nonemptyLargeString,
		token: totpToken,
	});
	if (!is(req.body, reqBody)) {
		throw new BadRequestError("Improper parameter types");
	}

	// ** TOTP Un-registration

	const { user /* validatedWithMfa */ } = await metadataFromRequest(req, res);
	const uid = user.uid;
	const accountId = user.currentAccountId;

	const givenPassword = req.body.password;
	const token = req.body.token;

	// Validate the user's passphrase
	const isPasswordGood = await compare(givenPassword, user.passwordHash);
	if (!isPasswordGood) {
		throw new UnauthorizedError("wrong-credentials");
	}

	// If the user has no secret, treat the secret as deleted and return 200
	if (user.totpSeed === null || user.totpSeed === undefined) {
		respondSuccess(res);
		return;
	}
	const secret = generateTOTPSecretURI(user.currentAccountId, user.totpSeed);

	// Re-validate TOTP
	const isCodeGood = verifyTOTP(token, secret);
	if (!isCodeGood) {
		throw new UnauthorizedError("wrong-mfa-credentials");
	}

	// Delete the secret and disable 2FA
	await upsertUser({
		currentAccountId: accountId,
		mfaRecoverySeed: null,
		passwordHash: user.passwordHash,
		passwordSalt: user.passwordSalt,
		pubnubCipherKey: user.pubnubCipherKey,
		requiredAddtlAuth: user.requiredAddtlAuth?.filter(t => t !== "totp") ?? [],
		totpSeed: null,
		uid,
	});

	// TODO: Re-issue an auth token with updated validatedWithMfa information
	respondSuccess(res);
});

export default dispatchRequests({ GET, DELETE });
