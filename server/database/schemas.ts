import Joi from "joi";
import "joi-extract-type";

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
export function isValidForSchema<S extends Joi.AnySchema>(
	tbd: unknown,
	schema: S
): tbd is Joi.extractType<S> {
	const { error } = schema.validate(tbd);
	return !error;
}

/**
 * Throws a {@link Joi.ValidationError} if the given value does not
 * match the given schema.
 */
export function assertSchema<S extends Joi.AnySchema>(
	tbd: unknown,
	schema: S
): asserts tbd is Joi.extractType<S> {
	const { error } = schema.validate(tbd);
	if (error) throw error;
}

const jwtPayload = Joi.object({
	uid: Joi.string().required(),
	hash: Joi.string(),
}).unknown(true);

export type JwtPayload = Joi.extractType<typeof jwtPayload>;

export function isJwtPayload(tbd: unknown): tbd is JwtPayload {
	return isValidForSchema(tbd, jwtPayload);
}

const user = Joi.object({
	uid: Joi.string().required(),
	currentAccountId: Joi.string().required(),
	passwordHash: Joi.string().required(),
	passwordSalt: Joi.string().required(),
});
export type User = Joi.extractType<typeof user>;

function isUser(tbd: unknown): tbd is User {
	return isValidForSchema(tbd, user);
}

export type Primitive = string | number | boolean | undefined | null;

/**
 * An object whose properties may only be primitive values.
 */
export type DocumentData<T> = {
	[K in keyof T]: Primitive;
};

const dataItem = Joi.object({
	ciphertext: Joi.string().required(),
	objectType: Joi.string().required(),
	cryption: Joi.string().valid("v0", "v1"),
});
export type DataItem = Joi.extractType<typeof dataItem>;

export function isDataItem(tbd: unknown): tbd is DataItem {
	return isValidForSchema(tbd, dataItem);
}

const userKeys = Joi.object({
	dekMaterial: Joi.string().required(),
	passSalt: Joi.string().required(),
	oldDekMaterial: Joi.string(),
	oldPassSalt: Joi.string(),
});
export type UserKeys = Joi.extractType<typeof userKeys>;

export function isUserKeys(tbd: unknown): tbd is UserKeys {
	return isValidForSchema(tbd, userKeys);
}

export type AnyDataItem = DataItem | UserKeys | User;

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

const documentRef = Joi.object({
	collectionId: Joi.string()
		.valid(...allCollectionIds)
		.required(),
	documentId: Joi.string().required(),
});

const setBatch = Joi.object({
	type: Joi.string().valid("set").required(),
	ref: documentRef.required(),
	data: dataItem.required(),
});

const deleteBatch = Joi.object({
	type: Joi.string().valid("delete").required(),
	ref: documentRef.required(),
});

const documentWriteBatch = Joi.alt(setBatch, deleteBatch);
export type DocumentWriteBatch = Joi.extractType<typeof documentWriteBatch>;

export function isDocumentWriteBatch(tbd: unknown): tbd is DocumentWriteBatch {
	return isValidForSchema(tbd, documentWriteBatch);
}

export type Identified<T> = T & { _id: string };
function isIdentified(tbd: unknown): tbd is Identified<unknown> {
	return isObject(tbd) && "_id" in tbd && typeof tbd["_id"] === "string";
}

export type IdentifiedDataItem = Identified<DataItem> | Identified<UserKeys> | User;

export function isIdentifiedDataItem(tbd: unknown): tbd is IdentifiedDataItem {
	return isIdentified(tbd) && (isDataItem(tbd) || isUserKeys(tbd) || isUser(tbd));
}
