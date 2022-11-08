import type { AccountableDB } from "./db";
import type { CollectionId } from "./api";
import type { RawServerResponse } from "./schemas.js";
import type { RequestOpts } from "oazapfts/lib/runtime";
import { HttpStatusCode } from "helpers/HttpStatusCode.js";
import { NetworkError } from "./errors/index.js";

type APIRequest<A extends Array<unknown>> = (
	...args: [...A, RequestOpts | undefined]
) => Promise<APIResponse>;

/**
 * The response type for most of the generated SDK operations. Operations with
 * this response type may be wrapped with {@link run} for some basic error handling.
 *
 * Operations whose possible responses do not fit this iterface should be handled separately.
 */
interface APIResponse {
	status: HttpStatusCode;
	data: RawServerResponse;
}

/**
 * Wraps API calls with some basic error handling.
 *
 * @throws a {@link NetworkError} if a response arrives with a status that is not 200.
 */
export async function run<A extends Array<unknown>>(
	r: APIRequest<A>,
	db: AccountableDB,
	...args: A
): Promise<RawServerResponse> {
	const result = await r(...args, { baseUrl: db.url.href });
	switch (result.status) {
		case HttpStatusCode.OK:
			return result.data;
		default:
			throw new NetworkError(result.status, result.data);
	}
}

/**
 * Route for:
 * - GET    `/v0/db/users/{user.id}/{collection.id}`
 * - DELETE `/v0/db/users/{user.id}/{collection.id}`
 */
export function databaseCollection<UID extends string>(
	uid: UID,
	collectionId: CollectionId
): `/v0/db/users/${typeof uid}/${typeof collectionId}` {
	return `/v0/db/users/${uid}/${collectionId}`;
}

/**
 * Route for:
 * - GET    `/v0/db/users/{user.id}/{collection.id}/{document.id}`
 * - POST   `/v0/db/users/{user.id}/{collection.id}/{document.id}`
 * - DELETE `/v0/db/users/{user.id}/{collection.id}/{document.id}`
 */
export function databaseDocument<UID extends string, Col extends CollectionId, Doc extends string>(
	uid: UID,
	collectionId: Col,
	documentId: Doc
): `/v0/db/users/${typeof uid}/${typeof collectionId}/${typeof documentId}` {
	return `/v0/db/users/${uid}/${collectionId}/${documentId}`;
}
