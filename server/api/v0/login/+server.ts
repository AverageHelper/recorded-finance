import type { MFAOption } from "../../../database/schemas.js";
import { assertMethod } from "../../../helpers/assertMethod.js";
import { BadRequestError, UnauthorizedError } from "../../../errors/index.js";
import { compare } from "../../../auth/generators.js";
import { is, nonempty, string, type } from "superstruct";
import { newAccessToken } from "../../../auth/jwt.js";
import { respondSuccess } from "../../../responses.js";
import { statsForUser, userWithAccountId } from "../../../database/io.js";

export async function POST(req: APIRequest, res: APIResponse): Promise<void> {
	assertMethod(req.method, "POST");
	const reqBody = type({
		account: nonempty(string()),
		password: nonempty(string()),
	});

	if (!is(req.body, reqBody)) {
		throw new BadRequestError("Improper parameter types");
	}

	// ** Create a JWT for the caller to use later

	const givenAccountId = req.body.account;
	const givenPassword = req.body.password;

	// ** Get credentials
	const user = await userWithAccountId(givenAccountId);
	if (!user) {
		console.debug(`Found no user under account ${JSON.stringify(givenAccountId)}`);
		throw new UnauthorizedError("wrong-credentials");
	}

	// ** Verify credentials
	const isPasswordGood = await compare(givenPassword, user.passwordHash);
	if (!isPasswordGood) {
		console.debug(`The given password doesn't match what's stored`);
		throw new UnauthorizedError("wrong-credentials");
	}

	// ** If the user's account has a TOTP secret set and locked-in, validate="totp"
	const validate: MFAOption | "none" =
		(user.totpSeed ?? "") && // has a secret
		user.requiredAddtlAuth?.includes("totp") === true // totp enabled
			? "totp"
			: "none";

	// ** Generate an auth token and send it along
	const access_token = await newAccessToken(req, user, []);
	const uid = user.uid;
	const { totalSpace, usedSpace } = await statsForUser(uid);
	respondSuccess(res, { access_token, validate, uid, totalSpace, usedSpace });
}
