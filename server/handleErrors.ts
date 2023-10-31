import { InternalError } from "./errors/InternalError";
import { logger } from "./logger";
import { respondError, respondInternalError } from "./responses";

/**
 * Calls the given request handler. If anything is thrown, an appropriate
 * error response is returned to the caller.
 *
 * @param req The request.
 * @param res The Response.
 * @param cb The request handler.
 * @returns The handler's resulting HTTP response if the handler was successful, or
 *  an error response if an error was thrown.
 */
export async function handleErrors(
	req: APIRequest,
	res: APIResponse,
	cb: APIRequestHandler
): Promise<void> {
	try {
		await cb(req, res);
	} catch (error) {
		if (res.headersSent) {
			logger.error("Handled error when headers were already sent:", error);
			return; // Something was already sent, assume some other function sent the error and don't try anything
		}
		if (error instanceof InternalError) {
			logger.debug(`Sending response [${error.status} (${error.code}): ${error.message}]`);
			if (!error.harmless) {
				logger.error("Non-harmless internal error:", error);
			}
			return respondError(res, error);
		}

		// These extra details may save us when the call stack is too deep for us to figure where this error came from:
		logger.error(
			`Unknown internal error for %s request at %s:`,
			req.method ?? "unknown",
			req.url ?? "unknown URL",
			error
		);
		return respondInternalError(res);
	}
}
