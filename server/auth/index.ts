import { asyncWrapper } from "../asyncWrapper.js";
import { Router } from "express";
import { throttle } from "./throttle.js";

import { deleteTotpSecret } from "../routes/v0/totp/deleteTotpSecret.js";
import { getSession } from "../routes/v0/getSession.js";
import { getTotpSecret } from "../routes/v0/totp/getTotpSecret.js";
import { postJoin } from "../routes/v0/postJoin.js";
import { postLeave } from "../routes/v0/postLeave.js";
import { postLogin } from "../routes/v0/postLogin.js";
import { postLogout } from "../routes/v0/postLogout.js";
import { postTotpValidate } from "../routes/v0/totp/postTotpValidate.js";
import { postUpdateAccountId } from "../routes/v0/postUpdateAccountId.js";
import { postUpdatePassword } from "../routes/v0/postUpdatePassword.js";

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
		.post("/join", throttle(), asyncWrapper(postJoin))
		.post("/login", throttle(), asyncWrapper(postLogin))
		.get("/totp/secret", asyncWrapper(getTotpSecret))
		.delete("/totp/secret", throttle(), asyncWrapper(deleteTotpSecret))
		.post("/totp/validate", throttle(), asyncWrapper(postTotpValidate))
		.get("/session", /* throttle(), */ asyncWrapper(getSession))
		.post("/logout", throttle(), postLogout)
		.post("/leave", throttle(), asyncWrapper(postLeave))
		.post("/updatepassword", throttle(), asyncWrapper(postUpdatePassword))
		.post("/updateaccountid", throttle(), asyncWrapper(postUpdateAccountId));
}
