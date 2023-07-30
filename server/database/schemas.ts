// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Infer, Struct, StructError } from "superstruct";
import type { JsonValue } from "./io";
import type { Opaque } from "type-fest";
import { UnreachableCaseError } from "../errors/UnreachableCaseError";
import {
	array,
	assert,
	define,
	enums,
	intersection,
	is,
	literal,
	nullable,
	object,
	optional,
	size,
	string,
	type,
	union,
} from "superstruct";

export { is };

const NORMAL_MAX_CHARS = 191; // Prisma's `String` default is VARCHAR(191)
const LARGE_MAX_CHARS = 65_535; // When we override to TEXT
// const HUGE_MAX_CHARS = 16777215; // When we override to MEDIUMTEXT

// Copied from lodash
export type ValueIteratorTypeGuard<T, S extends T> = (value: T) => value is S;

function isArray(tbd: unknown): tbd is Array<unknown> {
	// Compare with lodash
	return Array.isArray(tbd);
}

export function isArrayOf<T>(
	tbd: unknown,
	elementGuard: ValueIteratorTypeGuard<unknown, T>
): tbd is Array<T> {
	return isArray(tbd) && tbd.every(elementGuard);
}

export function isNonEmptyArray<T>(tbd: ReadonlyArray<T>): tbd is ReadonlyNonEmptyArray<T>;

export function isNonEmptyArray<T>(tbd: Array<T>): tbd is NonEmptyArray<T>;

export function isNonEmptyArray<T>(tbd: ReadonlyArray<T>): tbd is NonEmptyArray<T> {
	return tbd.length > 0;
}

export function isObject(tbd: unknown): tbd is Record<string, unknown> {
	return typeof tbd === "object" && tbd !== null && !Array.isArray(tbd);
}

/**
 * Throws a {@link StructError} if the given value does not
 * match the given schema.
 */
export function assertSchema<T>(tbd: unknown, schema: Struct<T>): asserts tbd is T {
	const [error] = schema.validate(tbd);
	if (error) throw error;
}

const mfaOptions = ["totp"] as const;

export type MFAOption = typeof mfaOptions[number];

export function isMfaOption(tbd: unknown): tbd is MFAOption {
	return is(tbd, enums(mfaOptions));
}

export const nonemptyString = size(string(), 1, NORMAL_MAX_CHARS);
export const nonemptyLargeString = size(string(), 1, LARGE_MAX_CHARS);
// export const nonemptyHugeString = size(string(), 1, HUGE_MAX_CHARS);

/**
 * A user ID.
 */
export type UID = Opaque<string, "UID">;
const uid = define<UID>("UID", v => is(v, nonemptyString));
export { uid as uidSchema };

/**
 * A string that is used to authenticate PubNub subscriptions, both to send and receive.
 */
export type PubNubToken = Opaque<string, "PubNubToken">;
const pubnubToken = define<PubNubToken>("PubNubToken", v => is(v, nonemptyLargeString));

export const jwtPayload = type({
	/** The ID of the signed-in user */
	uid,

	/**
	 * The MFA authentication methods the user used recently.
	 * Sensitive endpoints should check this value if the user
	 * has 2FA auth enabled.
	 */
	validatedWithMfa: array(enums(mfaOptions)),

	/** The token used to authenticate PubNub subscriptions. */
	pubnubToken,
});

export type JwtPayload = Infer<typeof jwtPayload>;

export function assertJwtPayload(tbd: unknown): asserts tbd is JwtPayload {
	return assert(tbd, jwtPayload);
}

/**
 * A hashed value, usually a password.
 */
export type Hash = Opaque<string, "Hash">;
const hash = define<Hash>("Hash", v => is(v, nonemptyString));

/**
 * The salt used to hash a value. Combines with the original value
 * to obtain a {@link Hash}.
 */
export type Salt = Opaque<string, "Salt">;
const salt = define<Salt>("Salt", v => is(v, nonemptyString));

/**
 * A value used to generate TOTP values. Combines with the server
 * secret and the current time to obtain a {@link TOTPToken}.
 */
export type TOTPSeed = Opaque<string, "TOTPSeed">;
const totpSeed = define<TOTPSeed>("TOTPSeed", v => is(v, nonemptyString));

/**
 * A six-digit token, or a longer recovery value.
 */
export type TOTPToken = Opaque<string, "TOTPToken">;
export const totpToken = define<TOTPToken>("TOTPToken", v => is(v, nonemptyString));

export function isTotpToken(tbd: unknown): tbd is TOTPToken {
	return is(tbd, totpToken);
}

/**
 * A key used to encrypt PubNub messages before sending them to PubNub's service.
 */
export type AESCipherKey = Opaque<string, "AESCipherKey">;
const aesCipherKey = define<AESCipherKey>("AESCipherKey", v => is(v, nonemptyString));

export const user = object({
	/**
	 * The user's unique ID. This value never changes for the life
	 * of the account.
	 */
	uid,

	/**
	 * The user's account ID, used to identify the user at login.
	 * The user may change this value at any time.
	 */
	currentAccountId: nonemptyString,

	/**
	 * The hash of the user's password.
	 */
	passwordHash: hash,

	/**
	 * The salt with which the user's password was hashed.
	 */
	passwordSalt: salt,

	/**
	 * A value which is used to generate a special value that
	 * will always be a valid TOTP code.
	 * // TODO: Should we regenerate this every time it's used?
	 */
	mfaRecoverySeed: optional(nullable(totpSeed)),

	/**
	 * Additional second-factor auth options that the user has enabled.
	 *
	 * If this value contains `"totp"`, then the user's `totpSeed`
	 * and the server's persistent `AUTH_SECRET` must be used in
	 * combination with the normal password validation data to
	 * allow the user access to their data.
	 */
	requiredAddtlAuth: optional(array(enums(mfaOptions))),

	/**
	 * The value which is used to generate the secret against which
	 * to validate time-based authentication tokens. The value is
	 * `null` or `undefined` if the user does not have TOTP enabled
	 * on their account and they have not begun to set up TOTP as
	 * their additional auth.
	 */
	totpSeed: optional(nullable(totpSeed)),

	/**
	 * The AES-256 cipher key used by PubNub for message-level encryption.
	 */
	pubnubCipherKey: aesCipherKey,
});
export type User = Infer<typeof user>;

function sortStrings(a: string, b: string): number {
	if (a > b) return 1;
	if (b > a) return -1;
	return 0;
}

/**
 * Returns the array if the given primitive is of the correct type.
 * Returns an empty array otherwise.
 */
function requiredAddtlAuth(primitive: JsonValue): Array<MFAOption> {
	if (!Array.isArray(primitive)) return [];
	const result = primitive.filter(isMfaOption).sort(sortStrings);
	return Array.from(new Set(result));
}

interface RawRequiredAddtlAuth {
	requiredAddtlAuth: JsonValue;
}

type WithRequiredAddtlAuth<T> = T & { requiredAddtlAuth: Array<MFAOption> };

/**
 * Computes a fully-typed `requiredAddtlAuth` property for the given `User`.
 */
export function computeRequiredAddtlAuth<User extends RawRequiredAddtlAuth>(
	user: User
): WithRequiredAddtlAuth<User> {
	return {
		...user,
		requiredAddtlAuth: requiredAddtlAuth(user.requiredAddtlAuth),
	};
}

export type Primitive = string | number | boolean | undefined | null;

/**
 * An object whose properties may only be primitive values.
 */
export type DocumentData<T> = {
	[K in keyof T]: Primitive;
};

const dataItem = object({
	ciphertext: nonemptyLargeString,
	objectType: nonemptyString,
	cryption: optional(enums(["v0", "v1"] as const)),
});
export type DataItem = Infer<typeof dataItem>;

export function isDataItem(tbd: unknown): tbd is DataItem {
	return is(tbd, dataItem);
}

const userKeys = object({
	dekMaterial: nonemptyLargeString,
	passSalt: salt,
	oldDekMaterial: optional(nonemptyLargeString),
	oldPassSalt: optional(salt),
});
export type UserKeys = Infer<typeof userKeys>;

export function isUserKeys(tbd: unknown): tbd is UserKeys {
	return is(tbd, userKeys);
}

export const allCollectionIds = [
	"accounts",
	"attachments",
	"keys",
	"locations",
	"tags",
	"transactions",
	"users",
] as const;

export type CollectionID = typeof allCollectionIds[number];

export function isCollectionId(tbd: string): tbd is CollectionID {
	return allCollectionIds.includes(tbd as CollectionID);
}

/** A subset of {@link CollectionID} that's used as a discriminator for DataItem collections. */
export type DataItemKey =
	| "accounts"
	| "attachments"
	| "locations"
	| "tags"
	| "transactions"
	| "users";

export function isDataItemKey(id: CollectionID): id is DataItemKey {
	switch (id) {
		case "accounts":
		case "attachments":
		case "locations":
		case "tags":
		case "transactions":
		case "users":
			return true;

		case "keys":
			return false;
		default:
			throw new UnreachableCaseError(id);
	}
}

export type AnyData = DataItem | UserKeys;

const documentRef = object({
	collectionId: enums(allCollectionIds),
	documentId: nonemptyString,
});

const setBatch = object({
	type: literal("set"),
	ref: documentRef,
	data: dataItem,
});

const deleteBatch = object({
	type: literal("delete"),
	ref: documentRef,
});

const documentWriteBatch = union([setBatch, deleteBatch]);
export type DocumentWriteBatch = Infer<typeof documentWriteBatch>;

export function isDocumentWriteBatch(tbd: unknown): tbd is DocumentWriteBatch {
	return is(tbd, documentWriteBatch);
}

const identified = type({
	_id: nonemptyString,
});

function _identified<T>(struct: Struct<T>): Struct<T & Infer<typeof identified>> {
	return intersection([struct, identified]);
}

export type Identified<T> = Infer<ReturnType<typeof _identified<T>>>;

export const identifiedDataItem = union([_identified(dataItem), _identified(userKeys)]);

export type IdentifiedDataItem = Infer<typeof identifiedDataItem>;
