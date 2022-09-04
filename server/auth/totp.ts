/* eslint-disable no-bitwise */
import { createHmac } from "node:crypto";
import { generateHash } from "./generators.js";
import { persistentSecret } from "./jwt.js";
import { URL } from "node:url";
import base32Decode from "base32-decode";
import safeCompare from "safe-compare";

// Based on https://medium.com/onfrontiers-engineering/two-factor-authentication-flow-with-node-and-react-7cbdf249f13
// and https://auth0.com/blog/from-theory-to-practice-adding-two-factor-to-node-dot-js/

const algorithm = "SHA1";

function generateHOTP(secret: string, counter: number): string {
	const decodedSecret = base32Decode(secret, "RFC4648");

	const buffer = Buffer.alloc(8);
	for (let i = 0; i < 8; i += 1) {
		buffer[7 - i] = counter & 0xff;
		counter >>= 8;
	}

	// Step 1: Generate an HMAC-SHA-1 value
	const hmac = createHmac(algorithm.toLowerCase(), Buffer.from(decodedSecret));
	hmac.update(buffer);
	const hmacResult = hmac.digest();

	// Step 2: Generate a 4-byte string (Dynamic Truncation)
	const offset = (hmacResult[hmacResult.length - 1] as number) & 0xf;
	const code =
		(((hmacResult[offset] as number) & 0x7f) << 24) |
		(((hmacResult[offset + 1] as number) & 0xff) << 16) |
		(((hmacResult[offset + 2] as number) & 0xff) << 8) |
		((hmacResult[offset + 3] as number) & 0xff);

	// Step 3: Compute an HOTP value
	return `${code % 10 ** 6}`.padStart(6, "0");
}

function generateTOTP(secret: string, window: number = 0): string {
	const counter = Math.floor(Date.now() / 30000);
	return generateHOTP(secret, counter + window);
}

/**
 * Checks that the given token fits the given secret.
 */
export function verifyTOTP(token: string, secretOrUri: string, window: number = 1): boolean {
	let secret: string;
	try {
		const uri = new URL(secretOrUri); // throws if not a URL
		const secretParam = uri.searchParams.get("secret");
		secret =
			uri.protocol === "otpauth:" && secretParam !== null && secretParam
				? secretParam
				: secretOrUri;
	} catch {
		secret = secretOrUri;
	}

	for (let errorWindow = -window; errorWindow <= window; errorWindow += 1) {
		const totp = generateTOTP(secret, errorWindow);
		if (safeCompare(token, totp)) return true;
	}
	return false;
}

/**
 * Generates a TOTP URI that contains the secret value that the user with
 * the given account ID may use to generate one-time auth codes. The secret
 * is stable for a given `seed` and `AUTH_SECRET`.
 *
 * @param accountId A string that identifies the user account. This value may
 *  be user-provided. This value is not used to create the user's TOTP secret.
 * @param seed The value used in combination with the server's `AUTH_SECRET`
 *  to generate the user's TOTP secret.
 */
export async function generateTOTPSecretURI(accountId: string, seed: string): Promise<string> {
	if (!accountId) throw new TypeError("accountId cannot be empty");
	if (!seed) throw new TypeError("seed cannot be empty");

	const issuer = "Accountable";
	const digits = 6; // number of digits
	const period = 30; // seconds
	const secret = await generateHash(seed, persistentSecret);

	const configUri = new URL(`otpauth://totp/${issuer}:${accountId}`);
	configUri.searchParams.set("algorithm", algorithm);
	configUri.searchParams.set("digits", `${digits}`);
	configUri.searchParams.set("issuer", issuer);
	configUri.searchParams.set("period", `${period}`);
	configUri.searchParams.set("secret", secret);

	return configUri.href;
}

/**
 * Generates a random string. This value is stable for a given `seed`
 * and `AUTH_SECRET`.
 *
 * @param seed The value used in combination with the server's `AUTH_SECRET`
 *  to generate the random string.
 */
export async function generateTOTPRecoverySecret(seed: string): Promise<string> {
	return await generateHash(seed, persistentSecret);
}
