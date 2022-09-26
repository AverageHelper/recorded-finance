// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Infer, Struct, StructError } from "superstruct";
import { UnreachableCaseError } from "../errors/UnreachableCaseError.js";
import {
	array,
	enums,
	intersection,
	is,
	literal,
	nonempty,
	nullable,
	object,
	optional,
	string,
	type,
	union,
} from "superstruct";

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

export function isNonEmptyArray<T>(tbd: Array<T>): tbd is NonEmptyArray<T> {
	return tbd.length > 0;
}

export function isObject(tbd: unknown): tbd is Record<string, unknown> {
	return typeof tbd === "object" && tbd !== null && !Array.isArray(tbd);
}

/** Returns `true` if the given value matches the given schema. */
export function isValidForSchema<T>(tbd: unknown, schema: Struct<T>): tbd is T {
	return is(tbd, schema);
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

export const jwtPayload = type({
	/** The ID of the signed-in user */
	uid: nonempty(string()),

	/**
	 * The MFA authentication methods the user used recently.
	 * Sensitive endpoints should check this value if the user
	 * has 2FA auth enabled.
	 */
	validatedWithMfa: array(enums(mfaOptions)),
});

export type JwtPayload = Infer<typeof jwtPayload>;

export function isJwtPayload(tbd: unknown): tbd is JwtPayload {
	return isValidForSchema(tbd, jwtPayload);
}

export const user = object({
	/**
	 * The user's unique ID. This value never changes for the life
	 * of the account.
	 */
	uid: nonempty(string()),

	/**
	 * The user's account ID, used to identify the user at login.
	 * The user may change this value at any time.
	 */
	currentAccountId: nonempty(string()),

	/**
	 * The hash of the user's password.
	 */
	passwordHash: nonempty(string()),

	/**
	 * The salt with which the user's password was hashed.
	 */
	passwordSalt: nonempty(string()),

	/**
	 * A value which is used to generate a special value that
	 * will always be a valid TOTP code.
	 * // TODO: Should we regenerate this every time it's used?
	 */
	mfaRecoverySeed: optional(nullable(nonempty(string()))),

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
	totpSeed: optional(nullable(nonempty(string()))),
});
export type User = Infer<typeof user>;

export type Primitive = string | number | boolean | undefined | null;

/**
 * An object whose properties may only be primitive values.
 */
export type DocumentData<T> = {
	[K in keyof T]: Primitive;
};

const dataItem = object({
	ciphertext: nonempty(string()),
	objectType: nonempty(string()),
	cryption: optional(enums(["v0", "v1"] as const)),
});
export type DataItem = Infer<typeof dataItem>;

export function isDataItem(tbd: unknown): tbd is DataItem {
	return isValidForSchema(tbd, dataItem);
}

const userKeys = object({
	dekMaterial: nonempty(string()),
	passSalt: nonempty(string()),
	oldDekMaterial: optional(nonempty(string())),
	oldPassSalt: optional(nonempty(string())),
});
export type UserKeys = Infer<typeof userKeys>;

export function isUserKeys(tbd: unknown): tbd is UserKeys {
	return isValidForSchema(tbd, userKeys);
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
export type DataItemKey = "accounts" | "attachments" | "locations" | "tags" | "transactions";

export function isDataItemKey(id: CollectionID): id is DataItemKey {
	switch (id) {
		case "accounts":
		case "attachments":
		case "locations":
		case "tags":
		case "transactions":
			return true;

		case "keys":
		case "users":
			return false;
		default:
			throw new UnreachableCaseError(id);
	}
}

export type AnyData = DataItem | UserKeys | User;

const documentRef = object({
	collectionId: enums(allCollectionIds),
	documentId: nonempty(string()),
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
	return isValidForSchema(tbd, documentWriteBatch);
}

const identified = type({
	_id: nonempty(string()),
});

function _identified<T>(struct: Struct<T>): Struct<T & Infer<typeof identified>> {
	return intersection([struct, identified]);
}

export type Identified<T> = Infer<ReturnType<typeof _identified<T>>>;

export const identifiedDataItem = union([_identified(dataItem), _identified(userKeys), user]);

export type IdentifiedDataItem = Infer<typeof identifiedDataItem>;
