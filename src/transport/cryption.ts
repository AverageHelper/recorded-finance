import type CryptoJS from "crypto-js";
import { isString } from "../helpers/isString";
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
		iterations: 10000,
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

export type DEKMaterial = CryptoJS.lib.CipherParams;

export class HashStore {
	private _hashedValue: string;

	constructor(value: string) {
		this._hashedValue = btoa(value);
	}

	get value(): Readonly<string> {
		return atob(this._hashedValue);
	}

	/** Overwrites the buffer with random data for _maximum paranoia_ */
	destroy(): void {
		const length = this._hashedValue.length;
		let result = "";
		const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		const charactersLength = characters.length;
		for (let i = 0; i < length; i++) {
			result += characters.charAt(Math.floor(Math.random() * charactersLength));
		}
		this._hashedValue = result;
	}

	toString(): string {
		return JSON.stringify({
			_hashedValue: this._hashedValue,
		});
	}
}

/** Makes special potatoes that are unique to the `input`. */
export async function hashed(input: string): Promise<string> {
	return btoa((await derivePKey(input, "salt")).value);
}

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

export function deriveDEK(pKey: HashStore, ciphertext: string): HashStore {
	const dekObject = decrypt({ ciphertext }, pKey);
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
	const dekMaterial = encrypt(dekObject, "KeyMaterial", pKey).ciphertext;

	return { dekMaterial, passSalt };
}

export async function newDataEncryptionKeyMaterial(password: string): Promise<KeyMaterial> {
	// To encrypt data
	const dek = new HashStore(Cryption.randomValue(Cryption.keySizeBits / Cryption.wordSizeBits));
	return await newDataEncryptionKeyMaterialForDEK(password, dek);
}

export async function newMaterialFromOldKey(
	oldPassword: string,
	newPassword: string,
	oldKey: KeyMaterial
): Promise<KeyMaterial> {
	const oldPKey = await derivePKey(oldPassword, oldKey.passSalt);
	const dek = deriveDEK(oldPKey, oldKey.dekMaterial);
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
 * @returns An object that can be stored in the server.
 */
export function encrypt<T extends string>(
	data: unknown,
	objectType: T,
	dek: HashStore
): EPackage<T> {
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
 * @param pkg The object that was stored in the server.
 * @param dek The data en/decryption key.
 * @returns The original data.
 */
export function decrypt<T extends string>(
	pkg: Pick<EPackage<T>, "ciphertext">,
	dek: HashStore
): unknown {
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
