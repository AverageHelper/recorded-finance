import type { AESCipherKey, Hash, Salt, TOTPSeed } from "../database/schemas";
import type { NonNegativeInteger } from "type-fest";
import { compare, genSalt, hash } from "bcryptjs";
import { generateSecureToken as _generateSecureToken } from "n-digit-token";
import crypto from "node:crypto";

export { compare };

type PositiveInteger<T extends number> = Exclude<NonNegativeInteger<T>, 0>;

/**
 * Generates a cryptographically secure pseudo random token of given number of digits.
 */
export function generateSecureToken<T extends number>(length: PositiveInteger<T>): TOTPSeed {
	return _generateSecureToken(length) as TOTPSeed;
}

/**
 * @returns a `Promise` that resolves to a cryptographically-random salt.
 */
export async function generateSalt(): Promise<Salt> {
	return (await genSalt(15)) as Salt;
}

/**
 * @returns A `Promise` that resolves to the encrypted data salt
 */
export async function generateHash(data: string, salt: Salt): Promise<Hash> {
	return (await hash(data, salt)) as Hash;
}

function randomBytes<N extends number>(number: PositiveInteger<N>): Buffer {
	const array = new Uint8Array(number);
	crypto.getRandomValues(array); // fills the array with random values
	return Buffer.from(array.buffer);
}

/**
 * Generates a new 32-character key for PubNub's AES 256 message-level encryption.
 */
export async function generateAESCipherKey(): Promise<AESCipherKey> {
	return await Promise.resolve(randomBytes(16).toString("hex") as AESCipherKey);
}

/**
 * Do a constant time string comparison. Always compare the complete
 * strings against each other to get a constant time. This method does
 * not short-cut if the two string's length differs.
 *
 * Runtime always corresponds to the length of the first parameter.
 */
export function timingSafeEqual(a: string, b: string): boolean {
	const encoder = new TextEncoder();
	const aBuf = encoder.encode(a);
	const bBuf = encoder.encode(b);

	// Strings must be the same length in order to compare with `timingSafeEqual`
	if (aBuf.byteLength !== bBuf.byteLength) return false;

	return crypto.timingSafeEqual(aBuf, bBuf);
}
