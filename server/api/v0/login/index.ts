import type { MFAOption } from "../../../database/schemas";
import { apiHandler, dispatchRequests } from "../../../helpers/apiHandler";
import { BadRequestError } from "../../../errors/BadRequestError";
import { compare } from "../../../auth/generators";
import { is, nonempty, string, type } from "superstruct";
import { logger } from "../../../logger";
import { newAccessTokens, setSession } from "../../../auth/jwt";
import { respondSuccess } from "../../../responses";
import { statsForUser, userWithAccountId } from "../../../database/read";
import { UnauthorizedError } from "../../../errors/UnauthorizedError";

export const POST = apiHandler("POST", async (req, res) => {
	const reqBody = type({
		account: nonempty(string()),
		password: nonempty(string()),
	});

	if (!is(req.body, reqBody)) {
		throw new BadRequestError("Improper parameter types");
	}

	const givenAccountId = req.body.account;
	const givenPassword = req.body.password;

	// ** Get credentials
	const user = await userWithAccountId(givenAccountId);
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
		(user.totpSeed ?? "") && // has a secret
		user.requiredAddtlAuth?.includes("totp") === true // totp enabled
			? "totp"
			: "none";

	// ** Create a JWT for the caller to use later
	const uid = user.uid;
	const pubnub_cipher_key = user.pubnubCipherKey;
	const { access_token, pubnub_token } = await newAccessTokens(user, []);
	const { totalSpace, usedSpace } = await statsForUser(uid);

	setSession(req, res, access_token);
	respondSuccess(res, {
		access_token,
		pubnub_cipher_key,
		pubnub_token,
		validate,
		uid,
		totalSpace,
		usedSpace,
	});
});

export default dispatchRequests({ POST });
