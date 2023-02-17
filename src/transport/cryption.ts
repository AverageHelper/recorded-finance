import type { EPackage, KeyMaterial } from "./cryptionProtocols";
import type { CryptionWorker } from "../workers/cryptionWorker";
import * as Comlink from "comlink";
import { DecryptionError } from "./errors/DecryptionError";
import { HashStore } from "./HashStore";
import { isProbablyRawDecryptionError } from "./errors/RawDecryptionError";

// TODO: If the data we're sending to the Worker is over 10 kb, we should probably not.

/**
 * @returns a new Web Worker proxy for working with en/decryption
 */
function worker(): Comlink.Remote<CryptionWorker> {
	return Comlink.wrap<CryptionWorker>(
		// Rollup translates this at build time:
		new Worker(new URL("../workers/cryptionWorker.ts", import.meta.url), { type: "module" })
	);
}

/**
 * Makes special potatoes that are unique to the `input`.
 */
export async function hashed(input: string): Promise<string> {
	return await worker().hashed(input);
}

/**
 * Derives a pKey that is unique to the given plaintext `password` and `salt` values.
 *
 * @param password The user's plaintext passphrase.
 * @param salt A salt to make the final key more unique.
 */
export async function derivePKey(password: string, salt: string): Promise<HashStore> {
	return HashStore.fromHashed(await worker().derivePKey(password, salt));
}

/**
 * Decrypts a DEK from `ciphertext` using the given `pKey`.
 *
 * @param pKey The key used to encrypt or decrypt the DEK.
 * @param ciphertext The encrypted DEK material.
 */
export async function deriveDEK(pKey: HashStore, ciphertext: string): Promise<HashStore> {
	try {
		return HashStore.fromHashed(await worker().deriveDEK(pKey.hashedValue, ciphertext));
	} catch (error) {
		if (!isProbablyRawDecryptionError(error)) throw error;
		throw new DecryptionError(error);
	}
}

/**
 * Creates a unique DEK value that may be used for encrypting data.
 *
 * @param password The user's plaintext passphrase.
 */
export async function newDataEncryptionKeyMaterial(password: string): Promise<KeyMaterial> {
	// To encrypt data
	return await worker().newDataEncryptionKeyMaterial(password);
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
	try {
		return await worker().newMaterialFromOldKey(oldPassword, newPassword, oldKey);
	} catch (error) {
		if (!isProbablyRawDecryptionError(error)) throw error;
		throw new DecryptionError(error);
	}
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
	return (await worker().encrypt(data, objectType, dek.hashedValue)) as EPackage<T>;
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
	try {
		return await worker().decrypt(pkg, dek.hashedValue);
	} catch (error) {
		if (!isProbablyRawDecryptionError(error)) throw error;
		throw new DecryptionError(error);
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
