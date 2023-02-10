import type { AttachmentSchema, DatabaseSchema } from "../model/DatabaseSchema.js";
import type { Attachment } from "../model/Attachment.js";
import type { HashStore, Unsubscribe, UserPreferences } from "../transport/index.js";
import type { KeyMaterial } from "../transport/cryptionProtocols";
import type { User } from "../transport/auth.js";
import { asyncMap } from "../helpers/asyncMap.js";
import { attachment as newAttachment } from "../model/Attachment.js";
import { BlobReader, Data64URIWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { bootstrap, updateUserStats } from "./uiStore.js";
import { derived, get, writable } from "svelte/store";
import { logger } from "../logger.js";
import { NetworkError, PlatformError } from "../transport/errors/index.js";
import { t } from "../i18n.js";
import { v4 as uuid } from "uuid";
import {
	dataUriToBlob,
	defaultPrefs,
	deleteAuthMaterial,
	deleteUserPreferences,
	deriveDEK,
	derivePKey,
	db as auth,
	getDoc,
	getAuthMaterial,
	hashed,
	newDataEncryptionKeyMaterial,
	newMaterialFromOldKey,
	setAuthMaterial,
	setUserPreferences,
	userPreferencesFromSnapshot,
	userRef,
	watchRecord,
} from "../transport";
import {
	createUserWithAccountIdAndPassword,
	deleteUser,
	enrollTotp,
	refreshSession,
	signInWithAccountIdAndPassword,
	signOut,
	unenrollTotp as _unenrollTotp,
	updateAccountId,
	updatePassword as _updatePassword,
	verifySessionWithTOTP,
} from "../transport/auth.js";

// TODO: Should probably intercept NetworkError in here, or perhaps closer to the REST calls

type LoginProcessState = "AUTHENTICATING" | "GENERATING_KEYS" | "FETCHING_KEYS" | "DERIVING_PKEY";

export const isNewLogin = writable(false);
export const currentUser = writable<User | null>(null);
export const accountId = derived(currentUser, u => u?.accountId ?? null);
export const uid = derived(currentUser, u => u?.uid ?? null);
export const pKey = writable<HashStore | null>(null);
export const loginProcessState = writable<LoginProcessState | null>(null);
export const preferences = writable(defaultPrefs());
export const userPrefsWatcher = writable<Unsubscribe | null>(null);

export const isSignupEnabled = import.meta.env.VITE_ENABLE_SIGNUP === "true";
export const isLoginEnabled = import.meta.env.VITE_ENABLE_LOGIN === "true";

export function clearAuthCache(): void {
	const watcher = get(userPrefsWatcher);
	if (watcher) watcher(); // needs to die before auth watcher
	userPrefsWatcher.set(null);
	get(pKey)?.destroy();
	pKey.set(null);
	loginProcessState.set(null);
	currentUser.set(null);
	isNewLogin.set(false);
	preferences.set(defaultPrefs());
	logger.debug("authStore: cache cleared");
}

export function lockVault(): void {
	get(pKey)?.destroy();
	pKey.set(null);
	isNewLogin.set(false);
	loginProcessState.set(null);
	logger.debug("authStore: keys forgotten, vault locked");
}

export function onSignedIn(user: User): void {
	currentUser.set(user);

	const watcher = get(userPrefsWatcher);
	if (watcher) {
		watcher();
		userPrefsWatcher.set(null);
	}

	const key = get(pKey);
	if (key === null) return; // No decryption key

	const userDoc = userRef(user.uid);
	userPrefsWatcher.set(
		watchRecord(userDoc, async snap => {
			const { dekMaterial } = await getDekMaterial();
			const dek = await deriveDEK(key, dekMaterial);
			if (snap.exists()) {
				const prefs = await userPreferencesFromSnapshot(snap, dek);
				preferences.set(prefs);
			} else {
				preferences.set(defaultPrefs());
			}
		})
	);
}

export async function onSignedOut(): Promise<void> {
	clearAuthCache();

	const { clearAccountsCache } = await import("./accountsStore");
	const { clearAttachmentsCache } = await import("./attachmentsStore");
	const { clearLocationsCache } = await import("./locationsStore");
	const { clearTagsCache } = await import("./tagsStore");
	const { clearTransactionsCache } = await import("./transactionsStore");
	clearAccountsCache();
	clearAttachmentsCache();
	clearLocationsCache();
	clearTagsCache();
	clearTransactionsCache();
}

export async function fetchSession(): Promise<void> {
	bootstrap();
	try {
		loginProcessState.set("AUTHENTICATING");
		// Salt using the user's account ID
		const { user } = await refreshSession(auth);
		await updateUserStats();
		onSignedIn(user);
	} catch (error) {
		// ignore "missing-token" errors, those are normal when we don't have a session yet
		if (!(error instanceof NetworkError) || error.code !== "missing-token") {
			logger.error(error);
		}
	} finally {
		// In any event, error or not:
		loginProcessState.set(null);
	}
}

export async function unlockVault(password: string): Promise<void> {
	const acctId = get(accountId);
	if (get(uid) === null || acctId === null) throw new PlatformError("auth/unauthenticated");

	await login(acctId, password);

	// TODO: Instead of re-authing, download the ledger and attempt a decrypt with the given password. If fail, throw. If succeed, continue.
}

async function finalizeLogin(password: string, user: User): Promise<void> {
	await updateUserStats();

	// Get the salt and dek material from server
	loginProcessState.set("FETCHING_KEYS");
	const material = await getDekMaterial();

	// Derive a pKey from the password, and remember it
	loginProcessState.set("DERIVING_PKEY");
	pKey.set(await derivePKey(password, material.passSalt));
	onSignedIn(user);
}

export async function login(accountId: string, password: string): Promise<void> {
	try {
		loginProcessState.set("AUTHENTICATING");
		// TODO: Also salt the password hash
		// Salt using the user's account ID
		const { user } = await signInWithAccountIdAndPassword(
			auth,
			accountId,
			await hashed(password) // FIXME: Should use OPAQUE or SRP instead
		);
		if (user.mfa.includes("totp")) throw new PlatformError("auth/unauthenticated");
		await finalizeLogin(password, user);
	} finally {
		// In any event, error or not:
		loginProcessState.set(null);
	}
}

/**
 * Verifies the given TOTP token. Returns the user's recovery token if
 * they have not yet seen it.
 */
export async function loginWithTotp(password: string, token: string): Promise<void> {
	try {
		loginProcessState.set("AUTHENTICATING");
		const [, { user }] = await verifySessionWithTOTP(auth, token);
		await finalizeLogin(password, user);
	} finally {
		loginProcessState.set(null);
	}
}

/**
 * Requests a new TOTP secret from the storage server. If the user
 * has not already confirmed a TOTP enrollment, then this function
 * resolves with the user's secret. Present this secret to the user,
 * perhaps as a QR code.
 *
 * @returns the user's new TOTP secret URI.
 */
export async function beginTotpEnrollment(): Promise<URL> {
	const rawSecret = await enrollTotp(auth);
	return new URL(rawSecret); // the server should have sent a valid URI
}

/**
 * Verifies the given time-based token, and returns the user's recovery token.
 *
 * @param token The current time-based token.
 * @throws an error if the user has already seen their recovery token
 * @returns the user's recovery token.
 */
export async function confirmTotpEnrollment(token: string): Promise<string> {
	const [recoveryToken] = await verifySessionWithTOTP(auth, token);
	if (recoveryToken === null) throw new Error(t("error.auth.totp-already-verified"));
	await fetchSession();

	return recoveryToken;
}

/**
 * Disables the user's TOTP requirement, and deletes the server's
 * stored TOTP secret.
 *
 * @param password The user's password.
 * @param token The current time-based token.
 */
export async function unenrollTotp(password: string, token: string): Promise<void> {
	await _unenrollTotp(auth, await hashed(password), token);
	await fetchSession();
}

/**
 * Throws a {@link NetworkError} with code `"missing-mfa-credentials"` if
 * the user still needs to verify their 2FA.
 */
export async function getDekMaterial(): Promise<KeyMaterial> {
	const user = auth.currentUser;
	if (!user) throw new Error(t("error.auth.unauthenticated"));

	const material = await getAuthMaterial(user.uid);
	if (!material) throw new Error(t("error.auth.create-account-first"));
	return material;
}

export function createAccountId(): string {
	return uuid().replace(/\W+/gu, "");
}

export async function createVault(accountId: string, password: string): Promise<void> {
	try {
		loginProcessState.set("AUTHENTICATING");
		const { user } = await createUserWithAccountIdAndPassword(
			auth,
			accountId,
			await hashed(password)
		);

		loginProcessState.set("GENERATING_KEYS");
		const material = await newDataEncryptionKeyMaterial(password);
		await setAuthMaterial(user.uid, material);
		await updateUserStats();

		loginProcessState.set("DERIVING_PKEY");
		pKey.set(await derivePKey(password, material.passSalt));
		isNewLogin.set(true);
		onSignedIn(user);
	} finally {
		// In any event, error or not:
		loginProcessState.set(null);
	}
}

export function clearNewLoginStatus(): void {
	isNewLogin.set(false);
}

export async function destroyVault(password: string): Promise<void> {
	if (!auth.currentUser) throw new Error(t("error.auth.unauthenticated"));

	const { deleteAllAccounts } = await import("./accountsStore");
	const { deleteAllAttachments } = await import("./attachmentsStore");
	const { deleteAllLocation } = await import("./locationsStore");
	const { deleteAllTags } = await import("./tagsStore");
	const { deleteAllTransactions } = await import("./transactionsStore");

	// The execution order is important here:
	await deleteAllAttachments();
	await deleteAllTransactions();
	await deleteAllTags();
	await deleteAllAccounts();
	await deleteAllLocation();
	await deleteUserPreferences(auth.currentUser.uid);
	await deleteAuthMaterial(auth.currentUser.uid);

	await deleteUser(auth, auth.currentUser, await hashed(password));
	await onSignedOut();
}

export async function updateUserPreferences(prefs: Partial<UserPreferences>): Promise<void> {
	const userId = get(uid);
	const key = get(pKey);
	if (key === null) throw new Error(t("error.cryption.missing-pek"));
	if (userId === null) throw new Error(t("error.auth.unauthenticated"));

	const { dekMaterial } = await getDekMaterial();
	const dek = await deriveDEK(key, dekMaterial);
	await setUserPreferences(userId, prefs, dek);
	await updateUserStats();
}

export async function regenerateAccountId(currentPassword: string): Promise<void> {
	const user = auth.currentUser;
	if (user === null) {
		throw new Error(t("error.auth.unauthenticated"));
	}

	const newAccountId = createAccountId();
	await updateAccountId(user, newAccountId, await hashed(currentPassword));
	await fetchSession(); // updates the stored account ID
	isNewLogin.set(true);
}

export async function updatePassword(oldPassword: string, newPassword: string): Promise<void> {
	const user = auth.currentUser;
	if (user === null) {
		throw new PlatformError("auth/unauthenticated");
	}

	// Get old DEK material
	const oldMaterial = await getAuthMaterial(user.uid);
	if (!oldMaterial) {
		throw new Error(t("error.auth.create-account-first"));
	}

	// Generate new pKey
	const newMaterial = await newMaterialFromOldKey(oldPassword, newPassword, oldMaterial);

	// Store new pKey
	await setAuthMaterial(user.uid, newMaterial);
	pKey.set(await derivePKey(newPassword, newMaterial.passSalt));
	delete newMaterial.oldDekMaterial;
	delete newMaterial.oldPassSalt;

	// Update auth password
	try {
		await _updatePassword(auth, user, await hashed(oldPassword), await hashed(newPassword));
	} catch (error) {
		// Overwrite the new key with the old key, and have user try again
		await setAuthMaterial(user.uid, oldMaterial);
		pKey.set(await derivePKey(oldPassword, oldMaterial.passSalt));
		throw error;
	}

	// Erase the old key
	await setAuthMaterial(user.uid, newMaterial);
	await updateUserStats();
}

export async function logout(): Promise<void> {
	await signOut(auth);
	await onSignedOut();
}

export async function getAllUserDataAsJson(): Promise<DatabaseSchema> {
	const userId = get(uid);
	const key = get(pKey);
	if (key === null) throw new Error(t("error.cryption.missing-pek"));
	if (userId === null) throw new Error(t("error.auth.unauthenticated"));

	const { getAllAccountsAsJson } = await import("./accountsStore");
	const { getAllAttachmentsAsJson } = await import("./attachmentsStore");
	const { getAllLocationsAsJson } = await import("./locationsStore");
	const { getAllTagsAsJson } = await import("./tagsStore");

	const { dekMaterial } = await getDekMaterial();
	const dek = await deriveDEK(key, dekMaterial);

	const userDoc = userRef(userId);
	const snap = await getDoc(userDoc);

	const [accounts, attachments, locations, tags] = await Promise.all([
		getAllAccountsAsJson(),
		getAllAttachmentsAsJson(),
		getAllLocationsAsJson(),
		getAllTagsAsJson(),
	]);

	const prefs = snap.exists() //
		? await userPreferencesFromSnapshot(snap, dek)
		: defaultPrefs();

	// JS seems to put these in the order we lay them. Do prefs first, since they're smol
	return {
		uid: userId,
		...prefs,
		accounts,
		attachments,
		locations,
		tags,
	};
}

/** Compresses the user's data into a data URI string. */
export async function compressUserData(shouldMinify: boolean): Promise<string> {
	// TODO: Investigate replacing zip.js with https://www.npmjs.com/package/jszip

	logger.debug("Preparing zip writer");
	const writer = new ZipWriter(new Data64URIWriter("application/zip"));
	logger.debug("Prepared zip writer");

	try {
		const rootName = "recorded-finance";
		logger.debug("Writing root folder");
		logger.debug("Wrote root folder");

		// ** Prepare database
		logger.debug("Getting user data");
		const rawData = await getAllUserDataAsJson();
		logger.debug("Got user data");
		logger.debug("Encoding user data");
		const data = JSON.stringify(rawData, undefined, shouldMinify ? undefined : "\t");
		const encodedData = data;
		logger.debug("Encoded user data");
		logger.debug("Writing user data");
		await writer.add(
			`${rootName}/database${shouldMinify ? "-raw" : ""}.json`,
			new TextReader(encodedData)
		);
		logger.debug("Wrote user data");

		// ** Prepare attachments

		// dynamic import because attachmentsStore imports authStore lol
		const { imageDataFromFile } = await import("./attachmentsStore");

		/** Mirrors the storage bucket layout */
		const userFilesPath = `${rootName}/storage/users/${rawData.uid}/attachments`;

		const filesToGet: Array<AttachmentSchema> = rawData.attachments ?? [];
		// FIXME: We may run out of memory here. Test with many files totaling more than 1 GB. Maybe operate on the attachments a few at a time?
		logger.debug("Downloading attachments");
		const filesGotten: Array<[Attachment, string]> = await asyncMap(filesToGet, async a => {
			const file = newAttachment({
				createdAt: a.createdAt,
				id: a.id,
				notes: a.notes?.trim() ?? null,
				storagePath: a.storagePath,
				title: a.title.trim(),
				type: a.type ?? "",
			});
			const data = await imageDataFromFile(file, false);
			return [file, data];
		});
		logger.debug("Downloaded attachments");
		for (const [f, d] of filesGotten) {
			// Get storage file name without extension, so that explorers don't try to treat the folder as JSON
			const mystifiedName = f.storagePath
				.slice(Math.max(0, f.storagePath.lastIndexOf("/") + 1))
				.split(".")[0] as string;
			const imagePath = `${userFilesPath}/${mystifiedName}/${f.title}`;
			const image = dataUriToBlob(d);
			logger.debug(`Adding attachment ${f.title} to zip`);
			await writer.add(imagePath, new BlobReader(image));
			logger.debug(`Added attachment ${f.title} to zip`);
		}

		// ** Zip them up
		logger.debug("Grabbing zip blob");
		const dataUri = await writer.close();
		logger.debug(`Got ${dataUri.length}-byte zip blob`);

		return dataUri;
	} catch (error) {
		await writer.close();
		throw error;
	}
}
