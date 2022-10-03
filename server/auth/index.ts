import { asyncWrapper } from "../asyncWrapper.js";
import { Router } from "express";
import { throttle } from "./throttle.js";

import * as join from "../api/v0/join/+server.js";
import * as login from "../api/v0/login/+server.js";
import * as totpSecret from "../api/v0/totp/secret/+server.js";
import * as totpValidate from "../api/v0/totp/validate/+server.js";
import * as session from "../api/v0/session/+server.js";
import * as logout from "../api/v0/logout/+server.js";
import * as leave from "../api/v0/leave/+server.js";
import * as updatepassword from "../api/v0/updatepassword/+server.js";
import * as updateaccountid from "../api/v0/updateaccountid/+server.js";

// TODO: Implement WebAuthn (and test passkey support!)

/**
 * Routes and middleware for a basic authentication flow. Installs a
 * `context` property on the request object that includes the caller's
 * authorized user ID.
 *
 * @see https://thecodebarbarian.com/oauth-with-node-js-and-express.html
 */
export function auth(): Router {
	return Router()
		.post("/join", throttle(), asyncWrapper(join.POST))
		.post("/login", throttle(), asyncWrapper(login.POST))
		.get("/totp/secret", /* throttle(), */ asyncWrapper(totpSecret.GET))
		.delete("/totp/secret", throttle(), asyncWrapper(totpSecret.DELETE))
		.post("/totp/validate", throttle(), asyncWrapper(totpValidate.POST))
		.get("/session", /* throttle(), */ asyncWrapper(session.GET))
		.post("/logout", throttle(), asyncWrapper(logout.POST))
		.post("/leave", throttle(), asyncWrapper(leave.POST))
		.post("/updatepassword", throttle(), asyncWrapper(updatepassword.POST))
		.post("/updateaccountid", throttle(), asyncWrapper(updateaccountid.POST));
}
