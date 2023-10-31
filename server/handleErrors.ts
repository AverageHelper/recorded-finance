import type { Context } from "hono";
import { errorResponse, internalErrorResponse } from "./responses";
import { InternalError } from "./errors/InternalError";
import { logger } from "./logger";

/**
 * Calls the given request handler. If anything is thrown, an appropriate
 * error response is returned to the caller.
 *
 * @param c The request context.
 * @param cb The request handler.
 * @returns The handler's resulting HTTP response if the handler was successful, or
 *  an error response if an error was thrown.
 */
export async function handleErrors<P extends string>(
	c: Context<Env, P>,
	cb: APIRequestHandler<P>
): Promise<Response> {
	try {
		return await cb(c);
	} catch (error) {
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
}
