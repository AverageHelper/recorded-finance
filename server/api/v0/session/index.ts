import { apiHandler } from "../../../helpers/apiHandler";
import { metadataFromRequest } from "../../../auth/requireAuth";
import { newAccessTokens, setSession } from "../../../auth/jwt";
import { statsForUser } from "../../../database/read";
import { successResponse } from "../../../responses";

const PATH = "/api/v0/session";

export const GET = apiHandler(PATH, "GET", null, async c => {
	// ** If the user has the cookie set, respond with a JWT for the user

	const metadata = await metadataFromRequest(c); // throws if bad

	const user = metadata.user;
	const uid = user.uid;
	const pubnub_cipher_key = user.pubnubCipherKey;
	const account = user.currentAccountId;
	const requiredAddtlAuth = user.requiredAddtlAuth ?? [];
	const { access_token, pubnub_token } = await newAccessTokens(c, user, metadata.validatedWithMfa);
	const { totalSpace, usedSpace } = await statsForUser(c, uid);

	await setSession(c, access_token);
	return successResponse(c, {
		account,
		access_token,
		pubnub_cipher_key,
		pubnub_token,
		requiredAddtlAuth,
		uid,
		totalSpace,
		usedSpace,
	});
});
