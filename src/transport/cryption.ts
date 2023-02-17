import type CryptoJS from "crypto-js";
import { isString } from "../helpers/isString";
import { HashStore } from "./HashStore.js";
import { t } from "../i18n";
import "crypto-js/sha512"; // to keep SHA512 algo from tree-shaking away
import AES from "crypto-js/aes";
import atob from "atob-lite";
import btoa from "btoa-lite";
import CryptoJSCore from "crypto-js/core";
import EncBase64 from "crypto-js/enc-base64";
import EncUtf8 from "crypto-js/enc-utf8";
import PBKDF2 from "crypto-js/pbkdf2";
import WordArray from "crypto-js/lib-typedarrays";

const Protocols = {
	v0: {
		/**
		 * crypto-js uses 32-bit words for PBKDF2
		 *
		 * See https://github.com/brix/crypto-js/blob/develop/docs/QuickStartGuide.wiki#sha-2
		 * See also https://cryptojs.gitbook.io/docs/#pbkdf2
		 */
		wordSizeBits: 32,
		keySizeBits: 8192, // my first aim was 256 bits, but that was actually WORDS, so this is the number of bits I was doing
		saltSizeBytes: 32,
		iterations: 10_000,
		keyEncoding: EncBase64,
		dataEncoding: EncUtf8,
		hasher: CryptoJSCore.algo.SHA512,
		cipher: AES,
		derivation: PBKDF2,

		/** Generates a cryptographically-secure random value. */
		randomValue(byteCount: number): string {
			return WordArray.random(byteCount).toString(EncBase64);
		},
	},
} as const;

const Cryption = Protocols.v0;

/**
 * Makes special potatoes that are unique to the `input`.
 */
export async function hashed(input: string): Promise<string> {
	return btoa((await derivePKey(input, "salt")).value);
}

/**
 * Derives a pKey that is unique to the given plaintext `password` and `salt` values.
 *
 * @param password The user's plaintext passphrase.
 * @param salt A salt to make the final key more unique.
 */
export async function derivePKey(password: string, salt: string): Promise<HashStore> {
	await new Promise(resolve => setTimeout(resolve, 10)); // wait 10 ms for UI

	return new HashStore(
		Cryption.derivation(password, salt, {
			iterations: Cryption.iterations,
			hasher: Cryption.hasher,
			keySize: Cryption.keySizeBits / Cryption.wordSizeBits,
		}).toString(Cryption.keyEncoding)
	);
}

/**
 * Decrypts a DEK from `ciphertext` using the given `pKey`.
 *
 * @param pKey The key used to encrypt or decrypt the DEK.
 * @param ciphertext The encrypted DEK material.
 */
export async function deriveDEK(pKey: HashStore, ciphertext: string): Promise<HashStore> {
	const dekObject = await decrypt({ ciphertext }, pKey);
	if (!isString(dekObject)) throw new TypeError(t("error.cryption.malformed-key"));

	return new HashStore(atob(dekObject));
}

async function newDataEncryptionKeyMaterialForDEK(
	password: string,
	dek: HashStore
): Promise<KeyMaterial> {
	// To make passwords harder to guess
	const passSalt = btoa(Cryption.randomValue(Cryption.saltSizeBytes));

	// To encrypt the dek
	const pKey = await derivePKey(password, passSalt);
	const dekObject = btoa(dek.value);
	const dekMaterial = (await encrypt(dekObject, "KeyMaterial", pKey)).ciphertext;

	return { dekMaterial, passSalt };
}

/**
 * Creates a unique DEK value that may be used for encrypting data.
 *
 * @param password The user's plaintext passphrase.
 */
export async function newDataEncryptionKeyMaterial(password: string): Promise<KeyMaterial> {
	// To encrypt data
	const dek = new HashStore(Cryption.randomValue(Cryption.keySizeBits / Cryption.wordSizeBits));
	return await newDataEncryptionKeyMaterialForDEK(password, dek);
}

/**
 * Creates a unique pKey from the given plaintext `newPassword` and
 * the key derived from `oldPassword` and `oldKey`.
 *
 * @param oldPassword The user's former plaintext passphrase.
 * @param newPassword The user's new plaintext passphrase.
 * @param oldKey The user's former pKey.
 */
export async function newMaterialFromOldKey(
	oldPassword: string,
	newPassword: string,
	oldKey: KeyMaterial
): Promise<KeyMaterial> {
	const oldPKey = await derivePKey(oldPassword, oldKey.passSalt);
	const dek = await deriveDEK(oldPKey, oldKey.dekMaterial);
	const newPKey = await newDataEncryptionKeyMaterialForDEK(newPassword, dek);

	return {
		dekMaterial: newPKey.dekMaterial,
		passSalt: newPKey.passSalt,
		oldDekMaterial: oldKey.dekMaterial,
		oldPassSalt: oldKey.passSalt,
	};
}

/**
 * Serializes data to be stored in untrusted environments.
 *
 * @param data The data to encrypt.
 * @param objectType A string representing the type of object stored.
 * @param dek The data en/decryption key.
 * @returns a promise that resolves with an object that can be stored as-is on a remote server.
 */
export async function encrypt<T extends string>(
	data: unknown,
	objectType: T,
	dek: HashStore
): Promise<EPackage<T>> {
	await new Promise(resolve => setTimeout(resolve)); // give UI a chance to breathe

	const plaintext = JSON.stringify(data);
	const ciphertext = Cryption.cipher.encrypt(plaintext, dek.value).toString();

	return { ciphertext, objectType, cryption: "v0" };
}

class DecryptionError extends Error {
	private constructor(message: string) {
		super(message);
		this.name = "DecryptionError";
	}

	static resultIsEmpty(): DecryptionError {
		return new DecryptionError(t("error.cryption.empty-result"));
	}

	static parseFailed(error: unknown, plaintext: string): DecryptionError {
		let message: string;
		if (error instanceof Error) {
			message = error.message;
		} else {
			message = JSON.stringify(error);
		}
		return new DecryptionError(
			t("error.cryption.plaintext-not-json", {
				values: { error: message, plaintext },
			})
		);
	}
}

/**
 * Deserializes encrypted data.
 *
 * @param pkg The object that was stored on a remote server.
 * @param dek The data en/decryption key.
 * @returns a promise that resolves with the original data.
 */
export async function decrypt<T extends string>(
	pkg: Pick<EPackage<T>, "ciphertext">,
	dek: HashStore
): Promise<unknown> {
	await new Promise(resolve => setTimeout(resolve)); // give UI a chance to breathe

	const { ciphertext } = pkg;
	const plaintext = Cryption.cipher.decrypt(ciphertext, dek.value).toString(Cryption.dataEncoding);

	if (!plaintext) {
		throw DecryptionError.resultIsEmpty();
	}

	try {
		return JSON.parse(plaintext) as unknown;
	} catch (error) {
		throw DecryptionError.parseFailed(error, plaintext);
	}
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
	 * and 10000 iterations of PBKDF2. Keys are encoded in Base64. Hashes are generated
	 * using SHA-512.
	 */
	cryption?: "v0";
}

export type DEKMaterial = CryptoJS.lib.CipherParams;
