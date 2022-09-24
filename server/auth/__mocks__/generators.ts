import type { compare as _compare } from "bcryptjs";
import type {
	generateSecureToken as _generateSecureToken,
	generateSalt as _generateSalt,
	generateHash as _generateHash,
} from "../generators.js";
import { jest } from "@jest/globals";

export const compare = jest
	.fn<typeof _compare>()
	.mockImplementation((a: unknown, b: unknown) => Promise.resolve(a === b));

export const generateSecureToken = jest
	.fn<typeof _generateSecureToken>()
	.mockReturnValue("NOT_SECURE_TOKEN");

export const generateSalt = jest.fn<typeof _generateSalt>().mockResolvedValue("INSECURE_SALT");

export const generateHash = jest.fn<typeof _generateHash>().mockResolvedValue("INSECURE_HASH");
