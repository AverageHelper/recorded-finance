import "source-map-support/register";
import { auth } from "./auth";
import { cors } from "./cors";
import { db } from "./db";
import { errorResponse, headers } from "./responses";
import { Hono } from "hono";
import { logger as reqLogger } from "hono/logger";
import { logger } from "./logger";
import { NotFoundError } from "./errors/NotFoundError";
import { version as appVersion } from "./version";
// import csurf from "csurf"; // TODO: Might be important later

import * as lol from "./api/v0";
import * as ping from "./api/v0/ping";
import * as serverVersion from "./api/v0/version";
import { badMethodFallback } from "./helpers/apiHandler";

export const app = new Hono<Env>()
	.basePath("/api")
	.use("*", reqLogger(logger.info))
	.use("*", cors)
	.use("*", headers)

	// Routes
	.get("/v0/", lol.GET)
	.all(badMethodFallback)

	.get("/v0/ping", ping.GET)
	.all(badMethodFallback)

	.get("/v0/version", serverVersion.GET)
	.all(badMethodFallback)

	.route("/v0/", auth) // Auth endpoints
	.route("/v0/db", db) // Database endpoints (checks auth)
	.all("*", c => {
		// 404
		return errorResponse(c, new NotFoundError(`No such path '${c.req.path}'`));
	});

// Cloudflare wants this:
export default app;

logger.info(`** Recorded Finance storage server v${appVersion} **`);
