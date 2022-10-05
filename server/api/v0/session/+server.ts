import { apiHandler } from "../../../helpers/apiHandler.js";
import { metadataFromRequest } from "../../../auth/requireAuth.js";
import { newAccessToken } from "../../../auth/jwt.js";
import { respondSuccess } from "../../../responses.js";
import { statsForUser } from "../../../database/io.js";

export const GET = apiHandler("GET", async (req, res) => {
	// ** If the user has the cookie set, respond with a JWT for the user

	const metadata = await metadataFromRequest(req, res); // throws if bad

	const access_token = await newAccessToken(req, res, metadata.user, metadata.validatedWithMfa);
	const uid = metadata.user.uid;
	const account = metadata.user.currentAccountId;
	const requiredAddtlAuth = metadata.user.requiredAddtlAuth ?? [];
	const { totalSpace, usedSpace } = await statsForUser(uid);

	respondSuccess(res, {
		account,
		access_token,
		requiredAddtlAuth,
		uid,
		totalSpace,
		usedSpace,
	});
});
