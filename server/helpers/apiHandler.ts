import { assertMethod } from "./assertMethod";
import { handleErrors } from "../handleErrors";
import { corsOptions } from "../cors";

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
		await handleErrors(req, res, async (req, res) => {
			await assertCors(req, res);
			assertMethod(req.method, method);
			await cb(req, res);
		});
	};
}

type StaticOrigin = boolean | string | RegExp | Array<boolean | string | RegExp>;

async function assertCors(req: APIRequest, res: APIResponse): Promise<void> {
	if (corsOptions.credentials === true) {
		res.setHeader("Access-Control-Allow-Credentials", "true");
	}
	if (corsOptions.allowedHeaders !== undefined) {
		res.setHeader("Access-Control-Allow-Headers", corsOptions.allowedHeaders);
	}
	if (req.headers.origin !== undefined) {
		const origin = await new Promise<StaticOrigin | undefined>((resolve, reject) => {
			if (typeof corsOptions.origin === "function") {
				corsOptions.origin(req.headers.origin, (err, origin) => {
					if (err) return reject(err);
					return resolve(origin);
				});
			}
		});
		if (typeof origin === "string") {
			res.setHeader("Access-Control-Allow-Origin", origin);
		} else if (origin === true) {
			res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
		}
	}
}
