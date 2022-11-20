import type { CollectionID } from "./db";
import type { DataItem } from "./api";
import type { Infer } from "superstruct";
import { isArray } from "../helpers/isArray";
import { isObject } from "../helpers/isObject";
import { UnexpectedResponseError } from "./errors";
import {
	array,
	assert as assertSchema,
	boolean,
	define,
	enums,
	is,
	nonempty,
	nullable,
	number,
	optional,
	string,
	StructError,
	type,
	union,
} from "superstruct";

export const primitive = nullable(union([string(), number(), boolean()]));
export type Primitive = Infer<typeof primitive>;

export function isPrimitive(tbd: unknown): tbd is Primitive {
	return is(tbd, primitive);
}

function isPrimitiveOrArray(tbd: unknown): tbd is Primitive | Array<Primitive> {
	return is(tbd, union([primitive, array(primitive)]));
}

export type DocumentData = Record<string, Primitive>;

interface DocumentRef {
	collectionId: CollectionID;
	documentId: string;
}

interface SetBatch {
	type: "set";
	ref: DocumentRef;
	data: DataItem;
}

interface DeleteBatch {
	type: "delete";
	ref: DocumentRef;
}

export type DocumentWriteBatch = SetBatch | DeleteBatch;

export function isRecord(tbd: unknown): tbd is Record<string, unknown> {
	return (
		tbd !== undefined && //
		tbd !== null &&
		isObject(tbd) &&
		!isArray(tbd)
	);
}

export const documentData = define<DocumentData>(
	"documentData",
	value => isRecord(value) && Object.values(value).every(isPrimitiveOrArray)
);

export const mfaValidation = enums(["totp"] as const);

export type MFAValidation = Infer<typeof mfaValidation>;

const rawServerResponse = type({
	contents: optional(string()),
	_id: optional(string()),
	message: optional(string()),
	code: optional(string()),
	version: optional(string()),
	totalSpace: optional(number()),
	usedSpace: optional(number()),
	pubnub_token: optional(nonempty(string())),
	pubnub_cipher_key: optional(nonempty(string())),
	recovery_token: optional(nonempty(string())),
	secret: optional(nonempty(string())),
	account: optional(string()),
	uid: optional(nonempty(string())),
	data: optional(nullable(union([documentData, array(documentData)]))),
	dataType: optional(enums(["single", "multiple"] as const)),
	validate: optional(string()), // expects "none" or "totp", but don't crash if we get something else
	requiredAddtlAuth: optional(array(string())), // expects ["totp"] or empty, but don't crash if we get something else
});

export function assertRawServerResponse(tbd: unknown): asserts tbd is RawServerResponse {
	try {
		assertSchema(tbd, rawServerResponse);
	} catch (error) {
		let message: string;
		if (error instanceof StructError) {
			message = error.message;
		} else {
			message = JSON.stringify(error, undefined, "  ");
		}
		throw new UnexpectedResponseError(`Invalid server response: ${message}`); // TODO: I18N
	}
}

export function isRawServerResponse(tbd: unknown): tbd is RawServerResponse {
	return is(tbd, rawServerResponse);
}

export type RawServerResponse = Infer<typeof rawServerResponse>;

const fileData = type({
	contents: string(),
	_id: string(),
});
export type FileData = Infer<typeof fileData>;

export function assertFileData(tbd: unknown): asserts tbd is FileData {
	try {
		assertSchema(tbd, fileData);
	} catch (error) {
		let message: string;
		if (error instanceof StructError) {
			message = error.message;
		} else {
			message = JSON.stringify(error, undefined, "  ");
		}
		throw new UnexpectedResponseError(`Invalid server response: ${message}`); // TODO: i18n
	}
}
