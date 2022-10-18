import { compare, genSalt, hash } from "bcryptjs";
import { generateSecureToken as _generateSecureToken } from "n-digit-token";
import { randomBytes } from "node:crypto";

export { compare };

/** Generate a cryptographically secure pseudo random token of given number of digits. */
export function generateSecureToken(length: number): string {
	return _generateSecureToken(length) as string;
}

/**
 * @returns a `Promise` that resolves to a cryptographically-random salt.
 */
export async function generateSalt(): Promise<string> {
	return await genSalt(15);
}

/**
 * @returns A `Promise` that resolves to the encrypted data salt
 */
export async function generateHash(data: string, salt: string): Promise<string> {
	return await hash(data, salt);
}

/**
 * Generates a new 32-character key for PubNub's AES 256 message-level encryption.
 */
export async function generateAESCipherKey(): Promise<string> {
	return await Promise.resolve(randomBytes(16).toString("hex"));
}
