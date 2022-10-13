import { assertMethod } from "./assertMethod";
import { env } from "../environment";
import { handleErrors } from "../handleErrors";
import { OriginError } from "../errors/OriginError";
import { URL } from "node:url";

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
			cors(req, res);
			if (req.method === "OPTIONS") {
				res.status(200).end();
				return;
			}

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
