import { apiHandler, dispatchRequests } from "../../../helpers/apiHandler";
import { compare } from "../../../auth/generators";
import { destroyUser } from "../../../database/write";
import { generateTOTPSecretURI, verifyTOTP } from "../../../auth/totp";
import { optional, type } from "superstruct";
import { successResponse } from "../../../responses";
import { nonemptyLargeString, nonemptyString, totpToken } from "../../../database/schemas";
import { UnauthorizedError } from "../../../errors/UnauthorizedError";
import { userWithAccountId } from "../../../database/read";

const PATH = "/api/v0/leave";

const reqBody = type({
	account: nonemptyString,
	password: nonemptyLargeString,
	token: optional(totpToken),
});

export const POST = apiHandler(PATH, "POST", reqBody, async c => {
	// Ask for full credentials, so we aren't leaning on a repeatable token
	const body = c.req.valid("json");
	const givenAccountId = body.account; // TODO: Get this from auth state instead
	const givenPassword = body.password;

	// ** Get credentials
	const storedUser = await userWithAccountId(c, givenAccountId);
	if (!storedUser) {
		throw new UnauthorizedError("wrong-credentials");
	}

	// ** Verify password credentials
	const isPasswordGood = await compare(givenPassword, storedUser.passwordHash);
	if (!isPasswordGood) {
		throw new UnauthorizedError("wrong-credentials");
	}

	// ** Verify MFA
	if (
		typeof storedUser.totpSeed === "string" &&
		storedUser.requiredAddtlAuth?.includes("totp") === true
	) {
		// TOTP is required
		const token = body.token;

		if (typeof token !== "string") throw new UnauthorizedError("missing-mfa-credentials");

		const secret = generateTOTPSecretURI(c, storedUser.currentAccountId, storedUser.totpSeed);
		const isValid = verifyTOTP(token, secret);
		if (!isValid) throw new UnauthorizedError("wrong-mfa-credentials");
	}

	// ** Delete the user
	await destroyUser(c, storedUser.uid);

	return successResponse(c);
});

export default dispatchRequests(PATH, { POST });
