import { genSalt, hash } from "bcrypt";
import { generateSecureToken as _generateSecureToken } from "n-digit-token";

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
