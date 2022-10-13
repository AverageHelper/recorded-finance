import { assertMethod } from "./assertMethod";
import { BadMethodError } from "../errors/BadMethodError";
import { env } from "../environment";
import { handleErrors } from "../handleErrors";
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
			cors(req, res);

			if (req.method === "OPTIONS") return respondOk(res);
			assertMethod(req.method, method);
			await cb(req, res);
		});
	};
}

const allowedOriginHostnames = new Set<string>();

// Add typical localhost variants
allowedOriginHostnames.add("localhost");
allowedOriginHostnames.add("127.0.0.1");
allowedOriginHostnames.add("::1");

// Add configured host to list of allowed origins
let configuredHostUrl = env("HOST") ?? env("VERCEL_URL") ?? null;
if (configuredHostUrl !== null) {
	if (!configuredHostUrl.startsWith("http")) {
		configuredHostUrl = `https://${configuredHostUrl}`;
	}
	try {
		const { hostname } = new URL(configuredHostUrl);
		allowedOriginHostnames.add(hostname);
	} catch {
		console.error(
			`Value for env key HOST or VERCEL_URL is not a valid URL: '${configuredHostUrl}'`
		);
	}
}

console.debug(`allowedOriginHostnames: ${JSON.stringify(Array.from(allowedOriginHostnames))}`);

function cors(req: APIRequest, res: APIResponse): void {
	res.setHeader(
		"Access-Control-Allow-Headers",
		"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
	);

	// Allow requests with no origin (mobile apps, curl, etc.)
	const origin = req.headers.origin;
	if (origin === undefined || !origin) {
		console.debug(`Handling request that has no origin`);
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
		console.debug(`Blocking request from origin: ${origin} (inferred hostname: <invalid-url>`);
		throw new OriginError();
	}

	if (!allowedOriginHostnames.has(hostname)) {
		console.debug(`Blocking request from origin: ${origin} (inferred hostname: ${hostname}`);
		throw new OriginError();
	}

	// Origin must be OK! Let 'em in
	console.debug(`Handling request from origin: ${cleanOrigin}`);
	res.setHeader("Access-Control-Allow-Origin", cleanOrigin);
	res.setHeader("Access-Control-Allow-Credentials", "true");
}
