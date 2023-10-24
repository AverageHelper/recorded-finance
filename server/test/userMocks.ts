import type { JWT } from "../auth/jwt";
import type { JwtPayload, UID, User } from "../database/schemas";

/* eslint-disable vitest/no-mocks-import */
import * as mockGenerators from "../auth/__mocks__/generators";
import * as mockJwt from "../auth/__mocks__/jwt";
import * as mockPubnub from "../auth/__mocks__/pubnub";
import * as mockRead from "../database/__mocks__/read";
/* eslint-enable vitest/no-mocks-import */

const uid: UID = "test-user-123" as UID;

const currentAccountId = "test-account";

const passwordHash = mockGenerators.DEFAULT_MOCK_HASH;

const passwordSalt = mockGenerators.DEFAULT_MOCK_SALT;

const pubnubCipherKey = mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY;

export const userWithoutTotp: Readonly<User> = {
	uid,
	currentAccountId,
	passwordHash,
	passwordSalt,
	pubnubCipherKey,
	totpSeed: null,
	mfaRecoverySeed: null,
	requiredAddtlAuth: [],
};

export const userWithTotp: Readonly<User> = {
	uid,
	currentAccountId,
	passwordHash,
	passwordSalt,
	pubnubCipherKey,
	totpSeed: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN,
	mfaRecoverySeed: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN,
	requiredAddtlAuth: ["totp"],
};

/**
 * Sets relevant mocks to pretend that a request was from the given user.
 * A test request will thereafter behave as if the request had a valid Bearer
 * token in the `Authentication` header.
 *
 * @param user The user to set as authenticated.
 * @param validatedWithMfa The level of MFA that the user is supposed to have used.
 * @returns The given user object, for convenience.
 */
export function setAuth(
	user: Readonly<User>,
	validatedWithMfa: JwtPayload["validatedWithMfa"] = []
): User {
	mockJwt.jwtFromRequest.mockReturnValue("let-me-in-1234" as JWT);
	mockJwt.verifyJwt.mockResolvedValue({
		uid: user.uid,
		validatedWithMfa,
		pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
	});
	mockRead.jwtExistsInDatabase.mockResolvedValue(false); // not expired
	mockRead.userWithUid.mockResolvedValue(user);
	return { ...user };
}
