import { apiHandler, dispatchRequests } from "../../../../helpers/apiHandler";
import { ConflictError } from "../../../../errors/ConflictError";
import { compare, generateSecureToken } from "../../../../auth/generators";
import { generateTOTPSecretURI, verifyTOTP } from "../../../../auth/totp";
import { metadataFromRequest } from "../../../../auth/requireAuth";
import { type } from "superstruct";
import { successResponse } from "../../../../responses";
import { nonemptyLargeString, totpToken } from "../../../../database/schemas";
import { UnauthorizedError } from "../../../../errors/UnauthorizedError";
import { upsertUser } from "../../../../database/write";

const PATH = "/api/v0/totp/secret";

export const GET = apiHandler(PATH, "GET", null, async c => {
	// ** TOTP Registration

	const { user, validatedWithMfa } = await metadataFromRequest(c);
	const uid = user.uid;
	const accountId = user.currentAccountId;

	if (validatedWithMfa.includes("totp") || user.requiredAddtlAuth?.includes("totp") === true) {
		// We definitely have a secret, the user used it to get here!
		// Or the user already has TOTP enabled.
		// Either way, we should not regenerate the token. Throw a 409:
		throw new ConflictError("totp-conflict", "You already have TOTP authentication enabled");
	}

	// GET implicitly handles HEAD; don't do anything destructive:
	if (c.req.method === "HEAD") return successResponse(c);

	// Generate and store the new secret
	const totpSeed = generateSecureToken(15);
	const secret = generateTOTPSecretURI(c, accountId, totpSeed);

	// We should not lock in the secret until the user hits /totp/validate with that secret.
	// Just set the secret, not the 2fa requirement
	await upsertUser(c, {
		currentAccountId: accountId,
		mfaRecoverySeed: user.mfaRecoverySeed ?? null,
		passwordHash: user.passwordHash,
		passwordSalt: user.passwordSalt,
		pubnubCipherKey: user.pubnubCipherKey,
		requiredAddtlAuth: user.requiredAddtlAuth?.filter(t => t !== "totp") ?? [],
		totpSeed,
		uid,
	});

	return successResponse(c, { secret });
});

const reqBody = type({
	password: nonemptyLargeString,
	token: totpToken,
});

export const DELETE = apiHandler(PATH, "DELETE", reqBody, async c => {
	// ** TOTP Un-registration

	const { user /* validatedWithMfa */ } = await metadataFromRequest(c);
	const uid = user.uid;
	const accountId = user.currentAccountId;

	const body = c.req.valid("json");
	const givenPassword = body.password;
	const token = body.token;

	// Validate the user's passphrase
	const isPasswordGood = await compare(givenPassword, user.passwordHash);
	if (!isPasswordGood) {
		throw new UnauthorizedError("wrong-credentials");
	}

	// If the user has no secret, treat the secret as deleted and return 200
	if (user.totpSeed === null || user.totpSeed === undefined) {
		return successResponse(c);
	}
	const secret = generateTOTPSecretURI(c, user.currentAccountId, user.totpSeed);

	// Re-validate TOTP
	const isCodeGood = verifyTOTP(token, secret);
	if (!isCodeGood) {
		throw new UnauthorizedError("wrong-mfa-credentials");
	}

	// Delete the secret and disable 2FA
	await upsertUser(c, {
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
	return successResponse(c);
});

export default dispatchRequests(PATH, { GET, DELETE });
