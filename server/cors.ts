import { logger } from "./logger";
import { OriginError } from "./errors/OriginError";
import { InternalError } from "./errors/InternalError";
import { errorResponse, internalErrorResponse, okCorsResponse } from "./responses";
import { concatStrings } from "./helpers/concatStrings";
import { env } from "./environment";

// Rolling our own CORS implementation, because Hono's overwrites our `Vary` header.

interface CORSOptions {
	allowMethods?: Array<string>;
	allowHeaders?: Array<string>;
	maxAge?: number;
	credentials?: boolean;
	exposeHeaders?: Array<string>;
}

export const cors: APIRequestMiddleware<"*"> = async (c, next) => {
	const opts: CORSOptions = {
		allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
		exposeHeaders: [],
		credentials: true,
		allowHeaders: [
			"X-CSRF-Token",
			"X-Requested-With",
			"Accept",
			"Accept-Version",
			"Content-Length",
			"Content-MD5",
			"Content-Type",
			"Date",
			"X-Api-Version",
		],
	};

	const allowedOriginHostnames = new Set<string>();

	// Add typical localhost variants
	allowedOriginHostnames.add("localhost");
	allowedOriginHostnames.add("127.0.0.1");
	allowedOriginHostnames.add("::1");

	// Add configured host to list of allowed origins
	const configuredHostUrl =
		env(c, "HOST") ?? concatStrings("https://", env(c, "VERCEL_URL")) ?? null;
	if (configuredHostUrl !== null) {
		try {
			const { hostname } = new URL(configuredHostUrl);
			allowedOriginHostnames.add(hostname);
		} catch {
			logger.warn(`Value for env key HOST is not a valid URL: '${configuredHostUrl}'`);
		}
	}

	logger.debug(`allowedOriginHostnames: ${JSON.stringify(Array.from(allowedOriginHostnames))}`);

	function findAllowOrigin(origin: string): string | null | undefined {
		// Not sure we're allowed to set certain headers during CORS preflight response...

		// Allow requests with no origin (mobile apps, curl, etc.)
		if (!origin) {
			logger.debug(`Handling request that has no origin`);
			return origin;
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
		return cleanOrigin;
	}

	function set(key: string, value: string): void {
		c.res.headers.set(key, value);
	}
	try {
		const allowOrigin = findAllowOrigin(c.req.header("origin") || "");
		if (allowOrigin) {
			set("Access-Control-Allow-Origin", allowOrigin);
		}
	} catch (error) {
		if (error instanceof InternalError) {
			return errorResponse(c, error);
		}
		return internalErrorResponse(c);
	}

	// Safari needs this. See https://stackoverflow.com/a/54337073
	set("Vary", "*");

	if (opts.credentials) {
		set("Access-Control-Allow-Credentials", "true");
	}
	if (opts.exposeHeaders?.length) {
		set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
	}
	if (c.req.method !== "OPTIONS") {
		await next();
		return;
	}

	if (opts.maxAge !== undefined) {
		set("Access-Control-Max-Age", opts.maxAge.toString());
	}
	if (opts.allowMethods?.length) {
		set("Access-Control-Allow-Methods", opts.allowMethods.join(","));
	}
	let headers = opts.allowHeaders;
	if (!headers?.length) {
		const requestHeaders = c.req.header("Access-Control-Request-Headers");
		if (requestHeaders) {
			headers = requestHeaders.split(/\s*,\s*/u);
		}
	}
	if (headers?.length) {
		set("Access-Control-Allow-Headers", headers.join(","));
	}
	c.res.headers.delete("Content-Length");
	c.res.headers.delete("Content-Type");
	return okCorsResponse(c);
};
