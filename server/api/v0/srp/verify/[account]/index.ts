import type { HashAlgorithm } from "../../../../../auth/srp";
import type { MFAOption } from "../../../../../database/schemas";
import { apiHandler, dispatchRequests } from "../../../../../helpers/apiHandler";
import { BadRequestError } from "../../../../../errors/BadRequestError";
import { enums, is, nonempty, string, type } from "superstruct";
import { newAccessTokens, setSession } from "../../../../../auth/jwt";
import { pathSegments } from "../../../../../helpers/pathSegments";
import { respondSuccess } from "../../../../../responses";
import { statsForUser, userWithAccountId } from "../../../../../database/reads";
import { UnauthorizedError } from "../../../../../errors/UnauthorizedError";
import {
	bigintFromHex,
	fakeSaltForUnknownUsername,
	hashAlgorithms,
	randomBits,
	RFC5054,
	serverPremasterSecret,
	serverPublicValue,
	verifier,
} from "../../../../../auth/srp";

export const POST = apiHandler("POST", async (req, res) => {
	const { account } = pathSegments(req, "account");
	const reqBody = type({
		A: nonempty(string()),
		alg: enums(hashAlgorithms),
	});

	if (!is(req.body, reqBody)) {
		throw new BadRequestError("Improper parameter types");
	}

	const A = bigintFromHex(req.body.A); // TODO: Catch errors from this, rethrow a bad-req error
	const H: HashAlgorithm = req.body.alg;

	// ** Get credentials
	const user = await userWithAccountId(account);
	if (!user) {
		console.debug(`Found no user under account ${JSON.stringify(account)}`);
		throw new UnauthorizedError("wrong-credentials");
	}

	const { N, g } = RFC5054.group2048;
	let s: bigint;
	let v: bigint;
	const storedUser = await userWithAccountId(account);
	const storedSalt = storedUser?.passwordSalt ?? null;
	const storedVerifier = storedUser?.passwordHash ?? null;
	if (storedSalt !== null && storedVerifier !== null) {
		s = bigintFromHex(storedSalt);
		v = bigintFromHex(storedVerifier);
	} else {
		s = fakeSaltForUnknownUsername(account);
		v = verifier(s, account, "badpass", N, g, H);
	}

	// ** Verify credentials
	const b = randomBits(256); // FIXME: Read B from session?
	const B = serverPublicValue(b, v, N, g, H);
	const S_server = serverPremasterSecret(b, N, g, v, { A }, H);

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
