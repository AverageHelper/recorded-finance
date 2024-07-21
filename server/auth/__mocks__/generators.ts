import type { AESCipherKey, Hash, Salt, TOTPSeed } from "../../database/schemas";
import type { compare as _compare } from "bcryptjs";
import type {
	generateSecureToken as _generateSecureToken,
	generateSalt as _generateSalt,
	generateHash as _generateHash,
	generateAESCipherKey as _generateAESCipherKey,
	timingSafeEqual as _timingSafeEqual,
} from "../generators";
import { beforeEach, vi } from "vitest";

export const compare = vi.fn<typeof _compare>();

export const DEFAULT_MOCK_SECURE_TOKEN = "NOT_SECURE_TOKEN" as TOTPSeed;

export const generateSecureToken = vi.fn<typeof _generateSecureToken>();

export const DEFAULT_MOCK_SALT = "INSECURE_SALT" as Salt;

export const generateSalt = vi.fn<typeof _generateSalt>();

export const DEFAULT_MOCK_HASH = "INSECURE_HASH" as Hash;

export const generateHash = vi.fn<typeof _generateHash>();

export const DEFAULT_MOCK_AES_CIPHER_KEY = "INSECURE_CIPHER_KEY" as AESCipherKey;

export const generateAESCipherKey = vi.fn<typeof _generateAESCipherKey>();

export const timingSafeEqual = vi.fn<typeof _timingSafeEqual>();

beforeEach(async () => {
	compare.mockImplementation((a: string, b: string) => Promise.resolve(a === b));
	generateSecureToken.mockReturnValue(DEFAULT_MOCK_SECURE_TOKEN);
	generateSalt.mockResolvedValue(DEFAULT_MOCK_SALT);
	generateHash.mockResolvedValue(DEFAULT_MOCK_HASH);
	generateAESCipherKey.mockResolvedValue(DEFAULT_MOCK_AES_CIPHER_KEY);
	timingSafeEqual.mockImplementation(
		// eslint-disable-next-line @typescript-eslint/consistent-type-imports
		(await vi.importActual<typeof import("../generators")>("../generators")).timingSafeEqual
	);
});
