import { badMethodFallback } from "../helpers/apiHandler";
import { Hono } from "hono";
import { throttle } from "./throttle";

import * as join from "../api/v0/join";
import * as login from "../api/v0/login";
import * as totpSecret from "../api/v0/totp/secret";
import * as totpValidate from "../api/v0/totp/validate";
import * as session from "../api/v0/session";
import * as logout from "../api/v0/logout";
import * as leave from "../api/v0/leave";
import * as updatepassword from "../api/v0/updatepassword";
import * as updateaccountid from "../api/v0/updateaccountid";

// TODO: Implement WebAuthn (and test passkey support!)

export const auth = new Hono<Env>({ strict: false })
	.post("/join", throttle, join.POST)
	.all(badMethodFallback)

	.post("/login", throttle, login.POST)
	.all(badMethodFallback)

	.get("/totp/secret", /* throttle, */ totpSecret.GET)
	.delete(throttle, totpSecret.DELETE)
	.all(badMethodFallback)

	.post("/totp/validate", throttle, totpValidate.POST)
	.all(badMethodFallback)

	.get("/session", /* throttle, */ session.GET)
	.all(badMethodFallback)

	.post("/logout", throttle, logout.POST)
	.all(badMethodFallback)

	.post("/leave", throttle, leave.POST)
	.all(badMethodFallback)

	.post("/updatepassword", throttle, updatepassword.POST)
	.all(badMethodFallback)

	.post("/updateaccountid", throttle, updateaccountid.POST)
	.all(badMethodFallback);
