import { apiHandler, dispatchRequests } from "../../../helpers/apiHandler";
import { BadRequestError } from "../../../errors/BadRequestError";
import { compare } from "../../../auth/generators";
import { destroyUser } from "../../../database/write";
import { generateTOTPSecretURI, verifyTOTP } from "../../../auth/totp";
import { is, nonempty, optional, string, type } from "superstruct";
import { respondSuccess } from "../../../responses";
import { totpToken } from "../../../database/schemas";
import { UnauthorizedError } from "../../../errors/UnauthorizedError";
import { userWithAccountId } from "../../../database/read";

export const POST = apiHandler("POST", async (req, res) => {
	const reqBody = type({
		account: nonempty(string()),
		password: nonempty(string()),
		token: optional(totpToken),
	});

	if (!is(req.body, reqBody)) {
		throw new BadRequestError("Improper parameter types");
	}

	// Ask for full credentials, so we aren't leaning on a repeatable token
	const givenAccountId = req.body.account;
	const givenPassword = req.body.password;

	// ** Get credentials
	const storedUser = await userWithAccountId(givenAccountId);
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
		const token = req.body.token;

		if (typeof token !== "string" || token === "")
			throw new UnauthorizedError("missing-mfa-credentials");

		const secret = generateTOTPSecretURI(storedUser.currentAccountId, storedUser.totpSeed);
		const isValid = verifyTOTP(token, secret);
		if (!isValid) throw new UnauthorizedError("wrong-mfa-credentials");
	}

	// ** Delete the user
	await destroyUser(storedUser.uid);

	respondSuccess(res);
});

export default dispatchRequests({ POST });
