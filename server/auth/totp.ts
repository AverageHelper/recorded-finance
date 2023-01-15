import { createHmac } from "node:crypto";
import { persistentSecret } from "./jwt";
import { URL } from "node:url";
import _base32Decode from "base32-decode";
import _base32Encode from "base32-encode";
import safeCompare from "safe-compare";

type Base32Variant = Parameters<typeof _base32Decode>[1];

const variant: Base32Variant = "RFC3548";
const algorithm = "SHA1";

export function base32Decode(data: string): ArrayBuffer {
	return _base32Decode(data, variant);
}

export function base32Encode(
	data: ArrayBuffer | Int8Array | Uint8Array | Uint8ClampedArray
): string {
	return _base32Encode(data, variant, { padding: false });
}

function generateHOTP(base32Secret: string, counter: number): string {
	/* eslint-disable no-bitwise */
	const decodedSecret = base32Decode(base32Secret);

	// Based on https://medium.com/onfrontiers-engineering/two-factor-authentication-flow-with-node-and-react-7cbdf249f13,
	// https://auth0.com/blog/from-theory-to-practice-adding-two-factor-to-node-dot-js/,
	// and https://github.com/guyht/notp/blob/master/index.js

	// Create a byte array
	const buffer = Buffer.alloc(8);
	for (let i = 0; i < 8; i += 1) {
		buffer[7 - i] = counter & 0xff;
		counter >>= 8;
	}

	// Generate an HMAC-SHA-1 value
	const hmac = createHmac(algorithm.toLowerCase(), Buffer.from(decodedSecret));
	hmac.update(buffer);
	const hmacResult = hmac.digest();

	// Generate a 4-byte string (Dynamic Truncation)
	const offset = (hmacResult[hmacResult.length - 1] as number) & 0xf;
	const code =
		(((hmacResult[offset] as number) & 0x7f) << 24) |
		(((hmacResult[offset + 1] as number) & 0xff) << 16) |
		(((hmacResult[offset + 2] as number) & 0xff) << 8) |
		((hmacResult[offset + 3] as number) & 0xff);
	/* eslint-enable no-bitwise */

	// Compute an HOTP value
	return `${code % 10 ** 6}`.padStart(6, "0");
}

interface GeneratorOptions {
	/** The current Unix timestamp (in milliseconds). If omitted, then `Date.now()` is used instead */
	now?: number;

	/** @default 0 */
	window?: number;
}

/** Generates a TOTP code from the given secret value. */
export function generateTOTP(base32Secret: string, options?: GeneratorOptions): string {
	const { now = Date.now(), window = 0 } = options ?? {};
	const counter = Math.floor(now / 30000);
	return generateHOTP(base32Secret, counter + window);
}

interface VerifierOptions {
	/** The current Unix timestamp (in milliseconds). If omitted, then `Date.now()` is used instead */
	now?: number;

	/** @default 1 */
	window?: number;
}

/**
 * Checks that the given token fits the given secret.
 */
export function verifyTOTP(token: string, secretOrUri: string, options?: VerifierOptions): boolean {
	const { now, window = 1 } = options ?? {};
	let secret: string;
	try {
		const uri = new URL(secretOrUri); // throws if not a URL

		// Can't fall back. Don't try to use the URI as a secret, it's not base-32
		if (uri.protocol !== "otpauth:") return false;

		const secretParam = uri.searchParams.get("secret");
		if (secretParam === null || !secretParam) return false;

		secret = secretParam;
	} catch {
		// fallback: not a URI, so use the secret as-is
		secret = secretOrUri;
	}

	for (let errorWindow = -window; errorWindow <= window; errorWindow += 1) {
		const totp = generateTOTP(secret, { now, window: errorWindow });
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
export function generateTOTPSecretURI(accountId: string, seed: string): string {
	if (!accountId) throw new TypeError("accountId cannot be empty");

	const issuer = "RecordedFinance";
	const digits = 6; // number of digits
	const period = 30; // seconds
	const secret = generateSecret(seed);

	const configUri = new URL(`otpauth://totp/${issuer}:${accountId}`);
	configUri.searchParams.set("algorithm", algorithm);
	configUri.searchParams.set("digits", `${digits}`);
	configUri.searchParams.set("issuer", issuer);
	configUri.searchParams.set("period", `${period}`);
	configUri.searchParams.set("secret", secret);

	return configUri.href;
}

/**
 * Generates a 21-character long cryptographically-random string,
 * encoded in base 32, that isstable for a given `seed` param and
 * `AUTH_SECRET` env variable.
 *
 * @param seed The value used in combination with the server's `AUTH_SECRET`
 *  environment variable to generate the random string.
 */
export function generateSecret(seed: string): string {
	if (!seed) throw new TypeError("seed cannot be empty");

	// Mix the secret and the seed together
	const hmac = createHmac(algorithm, persistentSecret);
	hmac.update(Buffer.from(seed));
	const digest = hmac.digest();

	return base32Encode(Buffer.from(digest).slice(0, 13)); // 21-char secret
}
