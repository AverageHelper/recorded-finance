import type { DocumentData, UID } from "./database";
import { describeCode, HttpStatusCode } from "./helpers/HttpStatusCode";
import { InternalError } from "./errors/InternalError";

// See https://stackoverflow.com/a/54337073 for why "Vary: *" is necessary for Safari
const VARY = ["Vary", "*"] as const;
const CACHE_CONTROL = ["Cache-Control", "no-store"] as const;
const CLACKS = ["X-Clacks-Overhead", "GNU Terry Pratchett"] as const;

/**
 * Sends HTTP 200, then ends the connection.
 */
export function respondOk(res: APIResponse): void {
	// Only works on HTTP versions older than HTTP/2 (for now).
	res.statusMessage = describeCode(HttpStatusCode.OK);
	res
		.setHeader(...CACHE_CONTROL)
		.setHeader(...VARY)
		.setHeader(...CLACKS)
		.status(HttpStatusCode.OK)
		.end();
}

/**
 * Sends HTTP 200 and a JSON value that includes the given `message`
 * string and other given key-value pairs, then ends the connection.
 */
export function respondMessage(
	res: APIResponse,
	message: string,
	additionalValues?: Record<string, string | number | null | ReadonlyArray<string | number>>
): void {
	// Only works on HTTP versions older than HTTP/2 (for now).
	res.statusMessage = describeCode(HttpStatusCode.OK);
	res
		.setHeader(...CACHE_CONTROL)
		.setHeader(...VARY)
		.setHeader(...CLACKS)
		.json({ ...additionalValues, message })
		.end();
}

/**
 * Sends HTTP 200 and a JSON value that includes the given key-value pairs, then ends the connection.
 */
export function respondSuccess(
	res: APIResponse,
	additionalValues?: Record<string, string | number | null | ReadonlyArray<string | number>>
): void {
	// Only works on HTTP versions older than HTTP/2 (for now).
	res.statusMessage = describeCode(HttpStatusCode.OK);
	res
		.setHeader(...CACHE_CONTROL)
		.setHeader(...VARY)
		.setHeader(...CLACKS)
		.json({ ...additionalValues, message: "Success!" })
		.end();
}

/**
 * Sends HTTP 200 and a JSON value that contains the given data, then ends the connection.
 */
export function respondData<T extends { _id: string } | { uid: UID }>(
	res: APIResponse,
	data: DocumentData<T> | ReadonlyArray<DocumentData<T>> | null
): void {
	// Only works on HTTP versions older than HTTP/2 (for now).
	res.statusMessage = describeCode(HttpStatusCode.OK);
	res
		.setHeader(...CACHE_CONTROL)
		.setHeader(...VARY)
		.setHeader(...CLACKS)
		.json({ message: "Success!", data }) // TODO: Should this go down as a multipart thingthing instead?
		.end();
}

/**
 * Sends an HTTP response as defined by the given error, then ends the connection.
 */
export function respondError(res: APIResponse, err: InternalError): void {
	// Only works on HTTP versions older than HTTP/2 (for now).
	res.statusMessage = describeCode(err.status);
	res.setHeader(...CACHE_CONTROL);
	res.setHeader(...VARY);
	res.setHeader(...CLACKS);
	err.headers.forEach((value, name) => {
		res.setHeader(name, value);
	});
	res.status(err.status).json({ message: err.message, code: err.code }).end();
}

/**
 * Sends HTTP 500, then ends the connection.
 */
export function respondInternalError(res: APIResponse): void {
	respondError(res, new InternalError());
}
