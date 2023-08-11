import { allowedOriginHostnames } from "../constants/allowedOriginHostnames";
import { assertMethod } from "./assertMethod";
import { BadMethodError } from "../errors/BadMethodError";
import { BadRequestError } from "../errors/BadRequestError";
import { compare, generateSecureToken } from "../auth/generators";
import { createCsrfJwt, csrfJwtFromRequest, verifyCsrfJwt } from "../auth/jwt";
import { handleErrors } from "../handleErrors";
import { is, nonempty, string, type } from "superstruct";
import { logger } from "../logger";
import { OriginError } from "../errors/OriginError";
import { respondError, respondOk } from "../responses";
import { URL } from "node:url";

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
 * export default dispatchRequests({ GET });
 * ```
 */
export function dispatchRequests(
	handlers: Partial<Record<HTTPMethod, APIRequestHandler>>
): VercelRequestHandler {
	return async (req, res) => {
		switch (req.method) {
			// Normal requests:
			case "GET":
			case "DELETE":
			case "POST": {
				const handler = handlers[req.method];
				if (handler) {
					await handler(req, res);
					break;
				} else {
					respondError(res, new BadMethodError());
					break;
				}
			}

			// CORS preflight:
			case "OPTIONS":
				cors(req, res);
				return respondOk(res);

			// Everything else:
			default:
				respondError(res, new BadMethodError());
				break;
		}
	};
}

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
			// TODO: helmet?
			cors(req, res);
			await csrf(req, res);

			if (req.method === "OPTIONS") return respondOk(res);
			// TODO: What to do about HEAD method?
			// TODO: Also assert body parameter types
			assertMethod(req.method, method);
			await cb(req, res);
		});
	};
}

/**
 * Asserts that the request `Origin` header is valid; one of the following applies:
 * - `Origin` is not provided (likely `curl` or a custom client)
 * - `Origin` is some variant of `localhost`
 * - `Origin` matches the configured front-end origin address
 */
function cors(req: APIRequest, res: APIResponse): void {
	res.setHeader(
		"Access-Control-Allow-Headers",
		"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
	);
	// Not sure we're allowed to set certain headers during CORS preflight response...

	// Allow requests with no origin (mobile apps, curl, etc.)
	const origin = req.headers.origin;
	if (origin === undefined || !origin) {
		logger.debug(`Handling request that has no origin`);
		return;
	}

	// Guard origin based on hostname
	let hostname: string;
	let cleanOrigin: string;

	try {
		const url = new URL(origin);
		hostname = url.hostname;
		cleanOrigin = url.origin;
	} catch {
		logger.debug(`Blocking request from origin: ${origin} (inferred hostname: <invalid-url>`);
		throw new OriginError();
	}

	if (!allowedOriginHostnames.has(hostname)) {
		logger.debug(`Blocking request from origin: ${origin} (inferred hostname: ${hostname}`);
		throw new OriginError();
	}

	// Origin must be OK! Let 'em in
	logger.debug(`Handling request from origin: ${cleanOrigin}`);
	res.setHeader("Access-Control-Allow-Origin", cleanOrigin);
	res.setHeader("Access-Control-Allow-Credentials", "true");

	// TODO: Also check Referrer header?
}

/**
 * Creates and returns a JWT with a random string.
 */
export async function newCsrfToken(): Promise<string> {
	const csrf = generateSecureToken(240);
	return await createCsrfJwt({ csrf });
}

export async function csrf(req: APIRequest, res: APIResponse): Promise<void> {
	// For CSRF (see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie)
	// 0. Set an HttpOnly and SameSite cookie on client on login with a JWT that contains a new random value

	// 1. Send the CSRF value as a cookie (in the /version endpoint)

	// 2. Each request, the server verifies the cookie and param match
	// 3. Reject the request (HTTP 400?) if the values do not match or if one is missing
	const token = csrfJwtFromRequest(req, res);
	if (token === null) throw new BadRequestError("CSRF cookie not found");
	const { csrf } = await verifyCsrfJwt(token);
	// TODO: The token should also know whose it is, unless we're logging in...

	const reqBody = type({
		csrf: nonempty(string()),
	});

	if (!is(req.body, reqBody)) {
		throw new BadRequestError("CSRF token not found");
	}
	const givenCsrf = req.body.csrf;

	// Compare from body and cookie, 400 if failed
	const isTokenGood = await compare(givenCsrf, csrf);
	if (!isTokenGood) {
		throw new BadRequestError("Incorrect CSRF Token");
	}

	// continue!
}
