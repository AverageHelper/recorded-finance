import type { Context } from "hono";
import type { DocumentData, UID } from "./database/schemas";
import { HttpStatusCode } from "./helpers/HttpStatusCode";
import { InternalError } from "./errors/InternalError";
import { secureHeaders } from "hono/secure-headers";

/**
 * Middleware that applies basic security headers to requests.
 */
export const headers = secureHeaders({
	reportingEndpoints: [
		{
			name: "GitHub",
			url: "https://github.com/RecordedFinance/recorded-finance/security/advisories/new",
		},
	],
	contentSecurityPolicy: {
		defaultSrc: ["'self'"],
		baseUri: ["'self'"],
		objectSrc: ["'none'"],
		scriptSrcAttr: ["'none'"],
		upgradeInsecureRequests: [],
	},
});

function applyCommonHeaders(c: Context<Env>): void {
	const CommonHeaders = {
		// ** Security **
		"Permissions-Policy":
			"accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), clipboard-read=(), clipboard-write=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=*, gamepad=(), geolocation=(), gyroscope=(), identity-credentials-get=(), idle-detection=(), interest-cohort=(), keyboard-map=(), local-fonts=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=*, publickey-credentials-create=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), speaker-selection=(), storage-access=(), sync-xhr=(), usb=(), web-share=*, xr-spatial-tracking=()",

		// ** Miscellaneous **
		"Cache-Control": "no-store",
		"X-Clacks-Overhead": "GNU Terry Pratchett",
	} as const;

	for (const [name, value] of Object.entries(CommonHeaders)) {
		c.header(name, value);
	}
}

/**
 * Creates and returns an HTTP 200 response with no data.
 *
 * @param c The request context.
 */
export function okResponse(c: Context<Env>): Response {
	applyCommonHeaders(c);
	return c.newResponse(null, HttpStatusCode.OK);
}

/**
 * Creates and returns an HTTP 204 response with no data.
 *
 * @param c The request context.
 */
export function okCorsResponse(c: Context<Env>): Response {
	return c.newResponse(null, HttpStatusCode.NO_CONTENT);
}

/**
 * Creates and returns an HTTP 200 response with a JSON value that includes
 * the given `message` string and other given key-value pairs.
 *
 * @param c The request context.
 * @param message The text of the message to send.
 * @param additionalValues Key-value pairs that should be sent alongside the message.
 */
export function messageResponse(
	c: Context<Env>,
	message: string,
	additionalValues?: Record<string, string | number | null | ReadonlyArray<string | number>>
): Response {
	applyCommonHeaders(c);
	return c.json({ ...additionalValues, message }, HttpStatusCode.OK);
}

/**
 * Creates and returns an HTTP 200 response with a JSON value that includes
 * the given key-value pairs.
 *
 * @param c The request context.
 * @param additionalValues Key-value pairs that should be sent alongside the success message.
 */
export function successResponse(
	c: Context<Env>,
	additionalValues?: Record<string, string | number | null | ReadonlyArray<string | number>>
): Response {
	applyCommonHeaders(c);
	return c.json({ ...additionalValues, message: "Success!" }, HttpStatusCode.OK);
}

/**
 * Creates and returns an HTTP 200 response with a JSON value that contains the given data.
 *
 * @param c The request context.
 * @param data The data to send to the caller.
 */
export function dataResponse<T extends { _id: string } | { uid: UID }>(
	c: Context<Env>,
	data: DocumentData<T> | ReadonlyArray<DocumentData<T>> | null
): Response {
	applyCommonHeaders(c);
	return c.json({ message: "Success!", data }, HttpStatusCode.OK);
}

function isArray(tbd: string | number | ReadonlyArray<string>): tbd is ReadonlyArray<string> {
	return Array.isArray(tbd);
}

/**
 * Creates and returns an HTTP response described by the given error.
 *
 * @param c The request context.
 * @param error The error to send to the caller.
 */
export function errorResponse(c: Context<Env>, error: InternalError): Response {
	error.headers.forEach((value, name) => {
		if (isArray(value)) {
			value.forEach(value => {
				c.header(name, value, { append: true });
			});
		} else if (typeof value === "string") {
			c.header(name, value);
		} else {
			c.header(name, `${value}`);
		}
	});
	applyCommonHeaders(c);
	return c.json({ message: error.message, code: error.code }, error.status);
}

/**
 * Creates and returns an HTTP 500 response.
 *
 * @param c The request context.
 */
export function internalErrorResponse(c: Context<Env>): Response {
	return errorResponse(c, new InternalError({ code: "unknown" }));
}
