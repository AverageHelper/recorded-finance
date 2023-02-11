import type { EPackage, KeyMaterial } from "../transport/cryptionProtocols";
import * as Comlink from "comlink";
import { cipher, encoder, hasher, Protocols } from "../transport/cryptionProtocols";
import { HashStore } from "../transport/HashStore";
import { logger } from "../logger";
import { RawDecryptionError } from "../transport/errors/RawDecryptionError";
import btoa from "btoa-lite";

// Vite rolls this into a single module on build, but uses modules at dev time.
// FIXME: Firefox only supports module workers in FF 111. Meantime, test under Chromium.

function derivePKey(password: string, salt: string): string {
	logger.debug("derivePKey started...");

	const Cryption = Protocols.v0;
	const result = new HashStore(
		Cryption.derivation(password, salt, {
			iterations: Cryption.iterations,
			hasher: hasher(Cryption.hasher),
			keySize: Cryption.keySizeBits / Cryption.wordSizeBits,
		}).toString(encoder(Cryption.keyEncoding))
	);

	logger.debug("derivePKey finished");
	return result.hashedValue;
}

function hashed(input: string): string {
	logger.debug("hashed started...");
	const result = HashStore.fromHashed(derivePKey(input, "salt")).hashedValue;

	logger.debug("hashed finished");
	return result;
}

function deriveDEK(encodedPKey: string, ciphertext: string): string {
	logger.debug("deriveDEK started...");

	const dekObject = decrypt({ ciphertext }, encodedPKey);
	if (typeof dekObject !== "string") throw RawDecryptionError.malformedKey();

	const result = HashStore.fromHashed(dekObject);

	logger.debug("deriveDEK finished");
	return result.hashedValue;
}

function newDataEncryptionKeyMaterialForDEK(password: string, encodedDek: string): KeyMaterial {
	logger.debug("newDataEncryptionKeyMaterialForDEK started...");

	// To make passwords harder to guess
	const dek = HashStore.fromHashed(encodedDek);
	const Cryption = Protocols.v0;
	const passSalt = btoa(Cryption.randomValue(Cryption.saltSizeBytes));

	// To encrypt the dek
	const pKey = derivePKey(password, passSalt);
	const dekObject = btoa(dek.value);
	const dekMaterial = encrypt(dekObject, "KeyMaterial", pKey).ciphertext;

	logger.debug("newDataEncryptionKeyMaterialForDEK finished");
	return { dekMaterial, passSalt };
}

function newDataEncryptionKeyMaterial(password: string): KeyMaterial {
	logger.debug("newDataEncryptionKeyMaterial started...");

	// To encrypt data
	const Cryption = Protocols.v0;
	const dek = new HashStore(Cryption.randomValue(Cryption.keySizeBits / Cryption.wordSizeBits));

	const result = newDataEncryptionKeyMaterialForDEK(password, dek.hashedValue);

	logger.debug("newDataEncryptionKeyMaterial finished");
	return result;
}

function newMaterialFromOldKey(
	oldPassword: string,
	newPassword: string,
	oldKey: KeyMaterial
): KeyMaterial {
	logger.debug("newMaterialFromOldKey started...");

	const oldPKey = derivePKey(oldPassword, oldKey.passSalt);
	const dek = deriveDEK(oldPKey, oldKey.dekMaterial);
	const newPKey = newDataEncryptionKeyMaterialForDEK(newPassword, dek);

	logger.debug("newMaterialFromOldKey finished");
	return {
		dekMaterial: newPKey.dekMaterial,
		passSalt: newPKey.passSalt,
		oldDekMaterial: oldKey.dekMaterial,
		oldPassSalt: oldKey.passSalt,
	};
}

function encrypt<T extends string>(data: unknown, objectType: T, encodedDek: string): EPackage<T> {
	logger.debug("encrypt started...");

	const dek = HashStore.fromHashed(encodedDek);
	const plaintext = JSON.stringify(data);
	const Cryption = Protocols.v0;
	const ciphertext = cipher(Cryption.cipher).encrypt(plaintext, dek.value).toString();

	logger.debug("encrypt finished");
	return { ciphertext, objectType, cryption: "v0" };
}

/**
 * Deserializes encrypted data.
 *
 * @param pkg The object that was stored in the server.
 * @param dek The data en/decryption key.
 * @returns The original data.
 */
function decrypt(
	pkg: Pick<EPackage<string>, "ciphertext" | "cryption">,
	encodedDek: string
): unknown {
	logger.debug("decrypt started...");

	const dek = HashStore.fromHashed(encodedDek);
	const { ciphertext, cryption } = pkg;
	const protocol = cryption ?? "v0";
	const Cryption = Protocols[protocol];
	const plaintext = cipher(Cryption.cipher)
		.decrypt(ciphertext, dek.value)
		.toString(encoder(Cryption.dataEncoding));

	if (!plaintext) {
		logger.debug("decrypt finished");
		throw RawDecryptionError.resultIsEmpty();
	}

	try {
		return JSON.parse(plaintext) as unknown;
	} catch (error) {
		throw RawDecryptionError.parseFailed(error, plaintext);
	} finally {
		logger.debug("decrypt finished");
	}
}

const cryptionWorker = {
	derivePKey,
	hashed,
	deriveDEK,
	newDataEncryptionKeyMaterial,
	newMaterialFromOldKey,
	encrypt,
	decrypt,
} as const;

// Import this when constructing the Worker
export type CryptionWorker = typeof cryptionWorker;

Comlink.expose(cryptionWorker);
