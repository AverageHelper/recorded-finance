import { InternalError } from "./errors/index.js";
import { respondError, respondInternalError } from "./responses.js";

export async function handleErrors(
	req: APIRequest,
	res: APIResponse,
	cb: APIRequestHandler
): Promise<void> {
	try {
		await cb(req, res);
	} catch (error) {
		if (!res.writable) {
			console.error(error);
			return; // Something was already sent, assume some other function sent the error and don't try anything
		}
		if (error instanceof InternalError) {
			if (error.harmless) {
				console.debug(`Sending response [${error.status} (${error.code}): ${error.message}]`);
			} else {
				console.error(error);
			}
			return respondError(res, error);
		}
		console.error(error);
		return respondInternalError(res);
	}
}
