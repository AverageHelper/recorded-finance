import type { ValidationTargets } from "hono";
import type { Infer, Struct } from "superstruct";
import { assertMethod } from "./assertMethod";
import { BadMethodError } from "../errors/BadMethodError";
import { BadRequestError } from "../errors/BadRequestError";
import { errorResponse, internalErrorResponse } from "../responses";
import { handleErrors } from "../handleErrors";
import { InternalError } from "../errors/InternalError";
import { logger } from "../logger";
import { requireAuth } from "../auth/requireAuth";
import { validate } from "superstruct";

// Only the methods we care about
type HTTPMethod = "GET" | "POST" | "DELETE";

/**
 * Creates a serverless function for a given HTTP method and handles errors.
 *
 * @param method The HTTP method that this function should accept. If the
 * request's method does not match this one for any reason, then a response
 * with code 405 is returned to the client.
 */
export function apiHandler<
	P extends string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	T extends Struct<any, any>,
	Target extends keyof ValidationTargets,
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
	validator: T | "form-data" | null,
	cb: APIRequestHandler<P, V>
): APIRequestHandler<P> {
	return async context => {
		return await handleErrors(context, async c => {
			if (c.req.method === "OPTIONS") {
				logger.error("Received OPTIONS request that should have been handled previously.");
				return internalErrorResponse(c);
			}

			// TODO: What to do about HEAD method?
			// TODO: Also assert body parameter types
			assertMethod(c.req.method, method);

			if (validator === null) {
				return await cb(c);
			}

			const contentType = c.req.header("Content-Type");

			if (validator === "form-data") {
				if (!contentType || !contentType.includes("multipart/form-data")) {
					throw new BadRequestError(`Invalid HTTP header: Content-Type=${contentType}`);
				}
				return await cb(c);
			}

			if (!contentType || !contentType.startsWith("application/json")) {
				// FIXME: This throws with FormData....
				throw new BadRequestError(`Invalid HTTP header: Content-Type=${contentType}`);
			}
			const data = c.req.raw.body ? await c.req.json<unknown>() : {};

			const [error, value] = validate<unknown, unknown>(data, validator, { coerce: true });
			if (error) {
				throw new BadRequestError(error.message);
			}
			// eslint-disable-next-line @typescript-eslint/ban-types
			c.req.addValidatedData("json", value as {});

			// const v = sValidator<typeof validator, "json", Env, P>("json", validator, onError);
			// await v(c, nopNext);
			return await cb(c);
		});
	};
}

export const badMethodFallback: APIRequestHandler<string> = async context => {
	return await handleErrors(context, () => {
		throw new BadMethodError();
	});
};

export const assertOwnership: APIRequestMiddleware<string> = async (c, next) => {
	try {
		await requireAuth(c);
		await next();
	} catch (error) {
		// FIXME: This is copied from `handleErrors`, lol
		if (error instanceof InternalError) {
			logger.debug(`Sending response [${error.status} (${error.code}): ${error.message}]`);
			if (!error.harmless) {
				logger.error("Non-harmless internal error:", error);
			}
			return errorResponse(c, error);
		}

		// These extra details may save us when the call stack is too deep for us to figure where this error came from:
		logger.error(
			`Unknown internal error for %s request at %s:`,
			c.req.method ?? "unknown",
			c.req.url ?? "unknown URL",
			error
		);
		return internalErrorResponse(c);
	}
	return undefined;
};
