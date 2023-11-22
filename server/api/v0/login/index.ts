import type { MFAOption } from "../../../database/schemas";
import { apiHandler, dispatchRequests } from "../../../helpers/apiHandler";
import { compare } from "../../../auth/generators";
import { logger } from "../../../logger";
import { newAccessTokens, setSession } from "../../../auth/jwt";
import { nonemptyLargeString, nonemptyString } from "../../../database/schemas";
import { type } from "superstruct";
import { statsForUser, userWithAccountId } from "../../../database/read";
import { successResponse } from "../../../responses";
import { UnauthorizedError } from "../../../errors/UnauthorizedError";

const PATH = "/api/v0/login";

const reqBody = type({
	account: nonemptyString,
	password: nonemptyLargeString,
});

export const POST = apiHandler(PATH, "POST", reqBody, async c => {
	// ** Create a JWT for the caller to use later

	const body = c.req.valid("json");
	const givenAccountId = body.account;
	const givenPassword = body.password;

	// ** Get credentials
	const user = await userWithAccountId(c, givenAccountId);
	if (!user) {
		logger.debug(`Found no user under account ${JSON.stringify(givenAccountId)}`);
		throw new UnauthorizedError("wrong-credentials");
	}

	// ** Verify credentials
	const isPasswordGood = await compare(givenPassword, user.passwordHash);
	if (!isPasswordGood) {
		logger.debug(`The given password doesn't match what's stored`);
		throw new UnauthorizedError("wrong-credentials");
	}

	// ** If the user's account has a TOTP secret set and locked-in, validate="totp"
	const validate: MFAOption | "none" =
		user.totpSeed && // has a secret
		user.requiredAddtlAuth?.includes("totp") === true // totp enabled
			? "totp"
			: "none";

	// ** Generate an auth token and send it along
	const uid = user.uid;
	const pubnub_cipher_key = user.pubnubCipherKey;
	const { access_token, pubnub_token } = await newAccessTokens(c, user, []);
	const { totalSpace, usedSpace } = await statsForUser(c, uid);

	await setSession(c, access_token);
	return successResponse(c, {
		access_token,
		pubnub_token,
		pubnub_cipher_key,
		validate,
		uid,
		totalSpace,
		usedSpace,
	});
});

export default dispatchRequests(PATH, { POST });
