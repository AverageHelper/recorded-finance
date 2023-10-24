import type { AESCipherKey, Hash, Salt, TOTPSeed } from "../../database/schemas";
import type { compare as _compare } from "bcryptjs";
import type {
	generateSecureToken as _generateSecureToken,
	generateSalt as _generateSalt,
	generateHash as _generateHash,
	generateAESCipherKey as _generateAESCipherKey,
} from "../generators";

export const compare = vi.fn<Parameters<typeof _compare>, ReturnType<typeof _compare>>();

export const DEFAULT_MOCK_SECURE_TOKEN = "NOT_SECURE_TOKEN" as TOTPSeed;

export const generateSecureToken = vi.fn<
	Parameters<typeof _generateSecureToken>,
	ReturnType<typeof _generateSecureToken>
>();

export const DEFAULT_MOCK_SALT = "INSECURE_SALT" as Salt;

export const generateSalt = vi.fn<
	Parameters<typeof _generateSalt>,
	ReturnType<typeof _generateSalt>
>();

export const DEFAULT_MOCK_HASH = "INSECURE_HASH" as Hash;

export const generateHash = vi.fn<
	Parameters<typeof _generateHash>,
	ReturnType<typeof _generateHash>
>();

export const DEFAULT_MOCK_AES_CIPHER_KEY = "INSECURE_CIPHER_KEY" as AESCipherKey;

export const generateAESCipherKey = vi.fn<
	Parameters<typeof _generateAESCipherKey>,
	ReturnType<typeof _generateAESCipherKey>
>();

beforeEach(() => {
	compare.mockImplementation((a: string, b: string) => Promise.resolve(a === b));
	generateSecureToken.mockReturnValue(DEFAULT_MOCK_SECURE_TOKEN);
	generateSalt.mockResolvedValue(DEFAULT_MOCK_SALT);
	generateHash.mockResolvedValue(DEFAULT_MOCK_HASH);
	generateAESCipherKey.mockResolvedValue(DEFAULT_MOCK_AES_CIPHER_KEY);
});
