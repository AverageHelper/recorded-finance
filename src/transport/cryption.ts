import type CryptoJS from "crypto-js";
import type { EPackage, KeyMaterial, Salt } from "./cryptionProtocols";
import type { Hashed } from "../workers/cryptionWorker";
import type { Obfuscated } from "./HashStore";
import { DecryptionError } from "./errors/DecryptionError";
import { HashStore } from "./HashStore";
import { isProbablyRawDecryptionError } from "./errors/RawDecryptionError";
import { isString } from "../helpers/isString";
import { t } from "../i18n";

// TODO: Make this a Comlink worker
import * as worker from "../workers/cryptionWorker";

async function wait(): Promise<void> {
	await new Promise(resolve => setTimeout(resolve, 10));
}

/**
 * Makes special potatoes that are unique to the `input`.
 */
export async function hashed(input: string): Promise<Hashed> {
	await wait();
	return worker.hashed(input);
}

/**
 * Derives a pKey that is unique to the given plaintext `password` and `salt` values.
 *
 * @param password The user's plaintext passphrase.
 * @param salt A salt to make the final key more unique.
 */
export async function derivePKey(password: string, salt: Salt): Promise<HashStore> {
	await wait();
	return HashStore.fromHashed(worker.derivePKey(password, salt));
}

/**
 * Decrypts a DEK from `ciphertext` using the given `pKey`.
 *
 * @param pKey The key used to encrypt or decrypt the DEK.
 * @param ciphertext The encrypted DEK material.
 */
export async function deriveDEK(pKey: HashStore, ciphertext: Obfuscated): Promise<HashStore> {
	const dekObject = await decrypt({ ciphertext }, pKey);
	if (!isString(dekObject)) throw new TypeError(t("error.cryption.malformed-key"));

	return new HashStore(atob(dekObject));
}

/**
 * Creates a unique DEK value that may be used for encrypting data.
 *
 * @param password The user's plaintext passphrase.
 */
export async function newDataEncryptionKeyMaterial(password: string): Promise<KeyMaterial> {
	// To encrypt data
	await wait();
	return worker.newDataEncryptionKeyMaterial(password);
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
		await wait();
		return worker.newMaterialFromOldKey(oldPassword, newPassword, oldKey);
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
	await wait();
	return worker.encrypt(data, objectType, dek.hashedValue);
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
	await wait();

	try {
		return worker.decrypt(pkg, dek.hashedValue);
	} catch (error) {
		if (!isProbablyRawDecryptionError(error)) throw error;
		throw new DecryptionError(error);
	}
}

export type DEKMaterial = CryptoJS.lib.CipherParams;
