import "source-map-support/register";
import { asyncWrapper } from "./asyncWrapper";
import { auth } from "./auth";
import { cors } from "./cors";
import { db } from "./db";
import { logger } from "./logger";
import { NotFoundError } from "./errors/NotFoundError";
import { respondError } from "./responses";
import { version as appVersion } from "./version";
// import csurf from "csurf"; // TODO: Might be important later
import express from "express";
import expressWs from "express-ws";
import helmet from "helmet";

import * as lol from "./api/v0";
import * as ping from "./api/v0/ping";
import * as serverVersion from "./api/v0/version";

const PORT = 40850;

export const app = express()
	.use(helmet()) // also disables 'x-powered-by' header
	.use(cors());

expressWs(app); // Set up websocket support. This is the reason our endpoint declarations need to be functions and not `const` declarations

app
	.get("/v0/", asyncWrapper(lol.GET))
	.get("/v0/ping", asyncWrapper(ping.GET))
	.get("/v0/version", asyncWrapper(serverVersion.GET))
	.set("trust proxy", 1) // trust first proxy
	.use(express.json({ limit: "5mb" }))
	.use(express.urlencoded({ limit: "5mb", extended: true }))
	.use("/v0/", auth()) // Auth endpoints
	.use("/v0/db", db()) // Database endpoints (checks auth)
	.use((req, res) => {
		// Custom 404
		respondError(res, new NotFoundError());
	});

app.listen(PORT, () => {
	logger.info(`Recorded Finance storage server v${appVersion} listening on port ${PORT}`);
});
