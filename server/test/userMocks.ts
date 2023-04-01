import type { UID, User } from "../database/schemas";

/* eslint-disable jest/no-mocks-import */
import * as mockGenerators from "../auth/__mocks__/generators";
/* eslint-enable jest/no-mocks-import */

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
