import { genSalt, hash } from "bcrypt";

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
