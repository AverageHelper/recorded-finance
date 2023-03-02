import { env } from "../environment";
import { logger } from "../logger";
import { URL } from "node:url";

const _allowedOriginHostnames = new Set<string>();

// Add typical localhost variants
_allowedOriginHostnames.add("localhost");
_allowedOriginHostnames.add("127.0.0.1");
_allowedOriginHostnames.add("::1");

// Add configured host to list of allowed origins
const configuredHostUrl = env("HOST") ?? env("VERCEL_URL") ?? null;
if (configuredHostUrl !== null) {
	try {
		const { hostname } = new URL(configuredHostUrl);
		_allowedOriginHostnames.add(hostname);
	} catch {
		logger.warn(`Value for env key HOST is not a valid URL: '${configuredHostUrl}'`);
	}
}

logger.debug(`allowedOriginHostnames: ${JSON.stringify(Array.from(_allowedOriginHostnames))}`);

export const allowedOriginHostnames: ReadonlySet<string> = _allowedOriginHostnames;
