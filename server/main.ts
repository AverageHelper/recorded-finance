import "source-map-support/register";
import { auth } from "./auth";
import { badMethodFallback, errorHandler } from "./helpers/apiHandler";
import { cors } from "./cors";
import { db } from "./db";
import { headers } from "./responses";
import { Hono } from "hono";
import { honoWs } from "./networking/websockets";
import { logger as reqLogger } from "hono/logger";
import { logger } from "./logger";
import { NotFoundError } from "./errors/NotFoundError";
import { serve } from "@hono/node-server";
import { version as appVersion } from "./version";
// import csurf from "csurf"; // TODO: Might be important later; see https://medium.com/@brakdemir/csrf-prevention-on-node-js-express-without-csurf-da5d9e6272ad

import * as lol from "./api/v0";
import * as ping from "./api/v0/ping";
import * as serverVersion from "./api/v0/version";

// eslint-disable-next-line unicorn/numeric-separators-style
const PORT = 40850;

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

	// All other paths answer 404:
	.notFound(c => {
		throw new NotFoundError(`No such path '${c.req.path}'`);
	})

	// Catch errors thrown from endpoints:
	.onError(errorHandler);

if (process.env["NODE_ENV"] !== "test") {
	const server = serve({ port: PORT, fetch: app.fetch }, info => {
		logger.info(`Recorded Finance storage server v${appVersion} listening on port ${info.port}`);
	});

	honoWs(server); // Set up websocket support.
}
