import type { ErrorHandler, ValidationTargets } from "hono";
import type { Infer, Struct } from "superstruct";
import { assertMethod } from "./assertMethod";
import { BadMethodError } from "../errors/BadMethodError";
import { BadRequestError } from "../errors/BadRequestError";
import { handle as vercel } from "@hono/node-server/vercel";
import { Hono } from "hono";
import { errorResponse } from "../responses";
import { InternalError } from "../errors/InternalError";
import { logger } from "../logger";
import { requireAuth } from "../auth/requireAuth";
import { validate } from "superstruct";

// Only the methods we care about
type HTTPMethod = "GET" | "POST" | "DELETE";

/**
 * Returns a Vercel request handler that dispatches `GET`, `DELETE`,
 * and `POST` requests to their respective handlers. `OPTIONS` requests
 * are handled as normal CORS preflight requests. Requests with other
 * methods, or methods for which no handler is defined, receive an
 * HTTP 405 error.
 *
 * ```ts
 * import { dispatchRequests } from "/path/to/apiHandler";
 * const GET = (req, res) => res.json("Hello, world!");
 *
 * export default dispatchRequests("/foo", { GET });
 * ```
 */
export function dispatchRequests<P extends string>(
	path: P,
	handlers: Partial<Record<HTTPMethod, APIRequestHandler<P>>>
): VercelRequestHandler {
	const handler: APIRequestHandler<P> = async c => {
		switch (c.req.method) {
			// Normal requests:
			case "GET":
			case "DELETE":
			case "POST": {
				const handler = handlers[c.req.method];
				if (!handler) throw new BadMethodError();
				return await handler(c);
			}

			// Hono implicitly handles HEAD with GET, so do the same on Vercel:
			case "HEAD": {
				const handler = handlers["GET"];
				if (!handler) throw new BadMethodError();
				const res = await handler(c);

				// Answer with headers and status without data
				return new Response(null, {
					headers: res.headers,
					status: res.status,
					statusText: res.statusText,
				});
			}

			// Everything else:
			default:
				throw new BadMethodError();
		}
	};

	const app = new Hono<Env>()
		.get(path, handler)
		.delete(handler)
		.post(handler)
		.all(badMethodFallback);

	return vercel(app);
}

/**
 * Creates a serverless function for a given HTTP method and handles errors.
 *
 * @param path The request path
 * @param method The HTTP method that this function should accept. If the
 * request's method does not match this one for any reason, then a response
 * with code 405 is returned to the client.
 * @param struct The expected shape of incoming data. Use a Superstruct
 * schema to expect JSON data, the string `"form-data"` to indicate form data,
 * or `null` to indicate any request body should be ignored.
 * @param cb The endpoint implementation.
 */
export function apiHandler<
	P extends string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	T extends Struct<any, any>,
	Target extends keyof ValidationTargets = "json",
	V extends {
		in: { [K in Target]: Infer<T> };
		out: { [K_1 in Target]: Infer<T> };
	} = {
		in: { [K_2 in Target]: Infer<T> };
		out: { [K_3 in Target]: Infer<T> };
	},
>(
	path: P,
	method: HTTPMethod,
	struct: T | "form-data" | null,
	cb: APIRequestHandler<P, V>
): APIRequestHandler<P, V> {
	return async c => {
		if (c.req.method.toUpperCase() === "OPTIONS") {
			throw new TypeError("Received OPTIONS request that should have been handled previously.");
		}

		assertMethod(c.req.method, method);

		if (struct === null) {
			// No body is expected. Send context as-is:
			return await cb(c);
		}

		// Body is expected. Ensure the header is consistent
		const contentType = c.req.header("Content-Type");

		if (struct === "form-data") {
			if (!contentType || !contentType.includes("multipart/form-data")) {
				throw new BadRequestError(
					`Invalid HTTP header: 'Content-Type=${contentType}'; expected 'multipart/form-data'`
				);
			}
			return await cb(c);
		}

		if (!contentType || !contentType.startsWith("application/json")) {
			throw new BadRequestError(
				`Invalid HTTP header: 'Content-Type=${contentType}'; expected 'application/json'`
			);
		}

		// Validate request body:
		const data = await c.req.json<unknown>(); // TODO: If this fails, we should return 400, not 500

		const [error, value] = validate(data, struct, { coerce: true });
		if (error) {
			throw new BadRequestError(error.message);
		}
		c.req.addValidatedData("json", value as object);

		return await cb(c);
	};
}

export const badMethodFallback: APIRequestHandler<string> = () => {
	throw new BadMethodError();
};

export const assertOwnership: APIRequestMiddleware<":uid"> = async (c, next) => {
	await requireAuth(c);
	await next();
};

export const errorHandler: ErrorHandler<Env> = (error: unknown, c) => {
	// Our own errors should be returned directly:
	if (error instanceof InternalError) {
		logger.debug(`Sending response [${error.status} (${error.code}): ${error.message}]`);
		if (!error.harmless) {
			logger.error("Non-harmless internal error:", error);
		}
		return errorResponse(c, error);
	}

	// Answer 500 for anything else:
	// These extra details may save us when the call stack is too deep for us to figure where this error came from:
	logger.error(
		`Unknown internal error for %s request at %s:`,
		c.req.method ?? "unknown",
		c.req.url ?? "unknown URL",
		error
	);
	return errorResponse(c, new InternalError({ code: "unknown" }));
};
