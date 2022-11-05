import type { HashAlgorithm } from "../../../../../auth/srp";
import { apiHandler, dispatchRequests } from "../../../../../helpers/apiHandler";
import { pathSegments } from "../../../../../helpers/pathSegments";
import { respondSuccess } from "../../../../../responses";
import { userWithAccountId } from "../../../../../database/reads";
import {
	bigintFromHex,
	fakeSaltForUnknownUsername,
	randomBits,
	RFC5054,
	serverPublicValue,
	toHexString,
	verifier,
} from "../../../../../auth/srp";

export const GET = apiHandler("GET", async (req, res) => {
	const { account } = pathSegments(req, "account");

	// ** Get verifier, or fake if the user isn't known or hasn't registered using SRP (See RFC 5054 §2.6)
	const { N, g } = RFC5054.group2048;
	const alg: HashAlgorithm = "sha256";
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
		v = verifier(s, account, "badpass", N, g, alg);
	}

	// Send "Server Hello" (See RFC 5054 §2.2)
	const b = randomBits(256); // FIXME: Should we keep B in the JWT for the second half of auth?
	const B = serverPublicValue(b, v, N, g, alg);

	respondSuccess(res, {
		N: toHexString(N),
		g: toHexString(g),
		s: toHexString(s),
		B: toHexString(B),
		alg,
	});
});

export default dispatchRequests({ GET });
