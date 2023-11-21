import { apiHandler, dispatchRequests } from "../../../helpers/apiHandler";
import { metadataFromRequest } from "../../../auth/requireAuth";
import { newAccessTokens, setSession } from "../../../auth/jwt";
import { respondSuccess } from "../../../responses";
import { statsForUser } from "../../../database/read";

export const GET = apiHandler("GET", async (req, res) => {
	// ** If the user has the cookie set, respond with a JWT for the user

	const metadata = await metadataFromRequest(req, res); // throws if bad

	const user = metadata.user;
	const uid = user.uid;
	const pubnub_cipher_key = user.pubnubCipherKey;
	const account = user.currentAccountId;
	const requiredAddtlAuth = user.requiredAddtlAuth ?? [];
	const { access_token, pubnub_token } = await newAccessTokens(user, metadata.validatedWithMfa);
	const { totalSpace, usedSpace } = await statsForUser(uid);

	setSession(req, res, access_token);
	respondSuccess(res, {
		account,
		access_token,
		pubnub_token,
		pubnub_cipher_key,
		requiredAddtlAuth,
		uid,
		totalSpace,
		usedSpace,
	});
});

export default dispatchRequests({ GET });
