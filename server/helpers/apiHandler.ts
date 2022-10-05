import { assertMethod } from "./assertMethod";
import { handleErrors } from "../handleErrors";

type HTTPMethod = "GET" | "POST" | "DELETE";

/**
 * Creates a serverless function for a given HTTP method and handles errors.
 *
 * @param method The HTTP method that this function should accept. If the
 * request's method does not match this one for any reason, then a response
 * with code 405 is returned to the client.
 */
export function apiHandler(method: HTTPMethod, cb: APIRequestHandler): APIRequestHandler {
	return async (req, res) => {
		assertMethod(req.method, method);
		await handleErrors(req, res, cb);
	};
}
