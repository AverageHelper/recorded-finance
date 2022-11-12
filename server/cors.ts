import type { CorsOptions } from "cors";
import { env } from "./environment";
import { logger } from "./logger";
import { OriginError } from "./errors/OriginError";
import { URL } from "node:url";
import _cors from "cors";

const allowedOriginHostnames = new Set<string>();

// Add typical localhost variants
allowedOriginHostnames.add("localhost");
allowedOriginHostnames.add("127.0.0.1");
allowedOriginHostnames.add("::1");

// Add configured host to list of allowed origins
const configuredHostUrl = env("HOST") ?? env("VERCEL_URL") ?? null;
if (configuredHostUrl !== null) {
	try {
		const { hostname } = new URL(configuredHostUrl);
		allowedOriginHostnames.add(hostname);
	} catch {
		logger.warn(`Value for env key HOST is not a valid URL: '${configuredHostUrl}'`);
	}
}

logger.debug(`allowedOriginHostnames: ${JSON.stringify(Array.from(allowedOriginHostnames))}`);

const corsOptions: CorsOptions = {
	credentials: true,
	origin: (origin, callback) => {
		// Allow requests with no origin (mobile apps, curl, etc.)
		if (origin === undefined || !origin) {
			logger.debug("Handling request that has no origin");
			return callback(null, true);
		}

		// Guard Origin
		try {
			const { hostname } = new URL(origin);

			if (!allowedOriginHostnames.has(hostname)) {
				logger.debug(`Blocking request from origin: ${origin} (inferred hostname: ${hostname})`);
				return callback(new OriginError(), false);
			}
		} catch {
			logger.debug(`Blocking request from origin: ${origin} (inferred hostname: <invalid-url>)`);
			return callback(new OriginError(), false);
		}

		// Origin must be OK! Let 'em in
		logger.debug(`Handling request from origin: ${origin}`);
		return callback(null, true);
	},
};

export function cors(): ReturnType<typeof _cors> {
	return _cors(corsOptions);
}
