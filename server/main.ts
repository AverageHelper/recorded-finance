import "source-map-support/register.js";
import { auth } from "./auth/index.js";
import { cors } from "./cors.js";
import { db } from "./db.js";
import { env } from "./environment.js";
import { handleErrors } from "./handleErrors.js";
import { lol } from "./routes/v0/index.js";
import { NotFoundError } from "./errors/NotFoundError.js";
import { ping } from "./routes/v0/ping.js";
import { respondError } from "./responses.js";
import { serverVersion } from "./routes/v0/version.js";
import { session } from "./auth/jwt.js";
import { version as appVersion } from "./version.js";
// import csurf from "csurf"; // TODO: Might be important later
import express from "express";
import expressWs from "express-ws";
import helmet from "helmet";

const PORT = 40850;

export const app = express()
	.use(helmet()) // also disables 'x-powered-by' header
	.use(cors());

expressWs(app); // Set up websocket support. This is the reason our endpoint declarations need to be functions and not `const` declarations

app
	.get("/v0/", lol)
	.get("/v0/ping", ping)
	.get("/v0/version", serverVersion)
	.set("trust proxy", 1) // trust first proxy
	.use(session)
	.use(express.json({ limit: "5mb" }))
	.use(express.urlencoded({ limit: "5mb", extended: true }))
	.use("/v0/", auth()) // Auth endpoints
	.use("/v0/db", db()) // Database endpoints (checks auth)
	.use((req, res) => {
		// Custom 404
		respondError(res, new NotFoundError());
	})
	.use(handleErrors);

// process.stdout.write(`NODE_ENV: ${env("NODE_ENV") ?? "undefined"}\n`);

app.listen(PORT, () => {
	process.stdout.write(
		`Accountable storage server v${appVersion} listening on port ${PORT} in ${
			env("NODE_ENV") ?? "unknown"
		} environment\n`
	);
});
