import { UnreachableCaseError } from "../transport/errors";
import "crypto-js/sha512"; // to keep SHA512 algo from tree-shaking away
import AES from "crypto-js/aes";
import CryptoJSCore from "crypto-js/core";
import EncBase64 from "crypto-js/enc-base64";
import EncUtf8 from "crypto-js/enc-utf8";
import PBKDF2 from "crypto-js/pbkdf2";
import WordArray from "crypto-js/lib-typedarrays";

export const Protocols = {
	/**
	 * Our proof-of-concept cryption protocol. #TODO: Migrate from this before our 1.0 release.
	 */
	v0: {
		wordSizeBits: 32,
		keySizeBits: 8192, // my first aim was 256 bits, but that was actually WORDS, so this is the number of bits I was doing
		saltSizeBytes: 32,
		iterations: 10_000,
		keyEncoding: "base64",
		dataEncoding: "utf8",
		hasher: "sha512",
		cipher: "aes",
		derivation: PBKDF2,
		randomValue,
	} satisfies CryptionProtocol,

	/**
	 * Our first real cryption protocol. (These values are not yet final.)
	 */
	/*
	v1: {
		wordSizeBits: 32,
		keySizeBits: 256,
		saltSizeBytes: 32,
		iterations: 600_000,
		keyEncoding: "base64",
		dataEncoding: "utf8",
		hasher: "sha512",
		cipher: "aes",
		derivation: PBKDF2,
		randomValue,
	} satisfies CryptionProtocol,
	*/
};

export type AvailableProtocols = keyof typeof Protocols;

export type Encoding = "base64" | "utf8";

export type Hash = "sha512";

export type Cipher = "aes";

export interface CryptionProtocol {
	/**
	 * crypto-js uses 32-bit words for PBKDF2
	 *
	 * See https://github.com/brix/crypto-js/blob/develop/docs/QuickStartGuide.wiki#sha-2
	 * See also https://cryptojs.gitbook.io/docs/#pbkdf2
	 */
	wordSizeBits: number;

	/**
	 * The number of bits that should comprise new cryptographic keys.
	 */
	keySizeBits: number;

	/**
	 * The number of bytes of random data to use for salts.
	 */
	saltSizeBytes: number;

	/**
	 * The number of iterations of our derivation function to use.
	 */
	iterations: number;

	/**
	 * How key strings should be encoded.
	 */
	keyEncoding: Encoding;

	/**
	 * How data strings should be encoded.
	 */
	dataEncoding: Encoding;

	/**
	 * The function used to create one-way hash values.
	 */
	hasher: Hash;

	/**
	 * The cipher function to use.
	 */
	cipher: Cipher;

	/**
	 * The function to use to derive keys from passwords or other secret values.
	 */
	derivation: typeof PBKDF2;

	/** Generates a cryptographically-secure random value. */
	randomValue(byteCount: number): string;
}

/**
 * User-level encryption material that lives on the server.
 * This data is useless without the user's password.
 */
export interface KeyMaterial {
	dekMaterial: string;
	passSalt: string;
	oldDekMaterial?: string;
	oldPassSalt?: string;
}

export interface EPackage<T extends string> {
	/**
	 * The encrypted payload. This data should be unreadable without the user's password.
	 */
	ciphertext: string;

	/** A string identifying to the application the type of data encoded. */
	objectType: T;

	/**
	 * A string identifying the en/decryption protocol to use.
	 *
	 * If this value is not set, `"v0"` is assumed.
	 *
	 * `"v0"` uses an AES cipher with a 256-word key (with 32-bit words), a 32-bit salt,
	 * and 10,000 iterations of PBKDF2. Keys are encoded in Base64. Hashes are generated
	 * using SHA-512.
	 *
	 * `"v1"` is not yet well-defined, and should not be used.
	 */
	cryption?: AvailableProtocols;
}

/**
 * @returns a CryptoJS encoder from the given descriptor.
 */
export function encoder(type: Encoding): typeof EncBase64 {
	switch (type) {
		case "base64":
			return EncBase64;
		case "utf8":
			return EncUtf8;
		default:
			throw new UnreachableCaseError(type);
	}
}

/**
 * @returns a CryptoJS hasher from the given descriptor.
 */
export function hasher(type: Hash): typeof CryptoJSCore.algo.SHA512 {
	switch (type) {
		case "sha512":
			return CryptoJSCore.algo.SHA512;
		default:
			throw new UnreachableCaseError(type);
	}
}

/**
 * @returns a CryptoJS cipher from the given descriptor.
 */
export function cipher(type: Cipher): typeof AES {
	switch (type) {
		case "aes":
			return AES;
		default:
			throw new UnreachableCaseError(type);
	}
}

export function randomValue(byteCount: number): string {
	return WordArray.random(byteCount).toString(encoder("base64"));
}
