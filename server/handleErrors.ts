import { InternalError } from "./errors/InternalError";
import { logger } from "./logger";
import { respondError, respondInternalError } from "./responses";

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
