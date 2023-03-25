import type { CorsOptions } from "cors";
import { allowedOriginHostnames } from "./helpers/allowedOriginHostnames";
import { logger } from "./logger";
import { OriginError } from "./errors/OriginError";
import { URL } from "node:url";
import _cors from "cors";

const corsOptions: CorsOptions = {
	credentials: true,
	allowedHeaders:
		"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
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
