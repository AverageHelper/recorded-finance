import type { DocumentData, UID } from "./database/schemas";
import { describeCode, HttpStatusCode } from "./helpers/HttpStatusCode";
import { InternalError } from "./errors/InternalError";

/**
 * Sets common headers on the given API response handle.
 *
 * @param res The response on which to set the headers.
 * @returns The same API response handle, modified with the common headers.
 */
function setCommonHeaders(res: APIResponse): APIResponse {
	// These should be set in vercel.json too, for frontend headers:
	return (
		res
			// CORS headers should have be set elsewhere, either before or after this call.

			// ** Security **
			.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains")
			.setHeader("X-Content-Type-Options", "nosniff")
			.setHeader(
				"Content-Security-Policy",
				"default-src 'self';base-uri 'self';object-src 'none';script-src-attr 'none';upgrade-insecure-requests"
			)
			.setHeader("X-Frame-Options", "SAMEORIGIN")
			.setHeader("Referrer-Policy", "no-referrer")
			.setHeader(
				"Permissions-Policy",
				"accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), clipboard-read=(), clipboard-write=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=*, gamepad=(), geolocation=(), gyroscope=(), identity-credentials-get=(), idle-detection=(), interest-cohort=(), keyboard-map=(), local-fonts=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=*, publickey-credentials-create=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), speaker-selection=(), storage-access=(), sync-xhr=(), usb=(), web-share=*, xr-spatial-tracking=()"
			)

			// ** Miscellaneous **
			// See https://stackoverflow.com/a/54337073 for why "Vary: *" is necessary for Safari
			.setHeader("Vary", "*")
			.setHeader("Cache-Control", "no-store")
			.setHeader("X-Clacks-Overhead", "GNU Terry Pratchett")
	);
}

/**
 * Sends HTTP 200, then ends the connection.
 */
export function respondOk(res: APIResponse): void {
	// Only works on HTTP versions older than HTTP/2 (for now).
	res.statusMessage = describeCode(HttpStatusCode.OK);
	setCommonHeaders(res);
	res.status(HttpStatusCode.OK).end();
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
	setCommonHeaders(res);
	res.json({ ...additionalValues, message }).end();
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
	setCommonHeaders(res);
	res.json({ ...additionalValues, message: "Success!" }).end();
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
	setCommonHeaders(res);
	res
		.json({ message: "Success!", data }) // TODO: Should this go down as a multipart thingthing instead?
		.end();
}

/**
 * Sends an HTTP response as defined by the given error, then ends the connection.
 */
export function respondError(res: APIResponse, err: InternalError): void {
	// Only works on HTTP versions older than HTTP/2 (for now).
	res.statusMessage = describeCode(err.status);
	setCommonHeaders(res);
	err.headers.forEach((value, name) => {
		res.setHeader(name, value);
	});
	res.status(err.status).json({ message: err.message, code: err.code }).end();
}

/**
 * Sends HTTP 500, then ends the connection.
 */
export function respondInternalError(res: APIResponse): void {
	respondError(res, new InternalError({ code: "unknown" }));
}
