import type { EPackage, KeyMaterial } from "./cryptionProtocols";
import type { CryptionWorker } from "../workers/cryptionWorker";
import * as Comlink from "comlink";
import { DecryptionError } from "./errors/DecryptionError";
import { HashStore } from "./HashStore";
import { isProbablyRawDecryptionError } from "./errors/RawDecryptionError";

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
 */
export async function derivePKey(password: string, salt: string): Promise<HashStore> {
	return HashStore.fromHashed(await worker().derivePKey(password, salt));
}

/**
 * Decrypts a DEK from `ciphertext` using the given `pKey`.
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
 */
export async function newDataEncryptionKeyMaterial(password: string): Promise<KeyMaterial> {
	// To encrypt data
	return await worker().newDataEncryptionKeyMaterial(password);
}

/**
 * Creates a unique pKey from the given plaintext `newPassword` and the key derived from `oldPassword` and `oldKey`.
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
 * @returns An object that can be stored in the server.
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
 * @param pkg The object that was stored in the server.
 * @param dek The data en/decryption key.
 * @returns The original data.
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
