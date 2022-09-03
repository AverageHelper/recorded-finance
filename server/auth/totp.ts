/* eslint-disable no-bitwise */
import { createHmac } from "node:crypto";
import { generateSalt } from "./generators.js";
import { URL } from "node:url";
import base32Decode from "base32-decode";

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
export function verifyTOTP(token: string, secret: string, window: number = 1): boolean {
	for (let errorWindow = -window; errorWindow <= window; errorWindow += 1) {
		const totp = generateTOTP(secret, errorWindow);
		if (token === totp) return true;
	}
	return false;
}

/**
 * Generates a new TOTP secret that the user with the given account ID may use
 * to generate one-time auth codes.
 */
export async function generateTOTPSecret(accountId: string): Promise<string> {
	if (!accountId) throw new TypeError("accountId cannot be empty");

	const issuer = "Accountable";
	const digits = 6; // number of digits
	const period = 30; // seconds
	const secret = await generateSalt();

	const configUri = new URL(`otpauth://totp/${issuer}:${accountId}`);
	configUri.searchParams.set("algorithm", algorithm);
	configUri.searchParams.set("digits", `${digits}`);
	configUri.searchParams.set("issuer", issuer);
	configUri.searchParams.set("period", `${period}`);
	configUri.searchParams.set("secret", secret);

	return configUri.href;
}
