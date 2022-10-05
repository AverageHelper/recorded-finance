import { addJwtToBlacklist, jwtTokenFromRequest, killSession } from "../../../auth/jwt.js";
import { apiHandler } from "../../../helpers/apiHandler.js";
import { respondSuccess } from "../../../responses.js";

export const POST = apiHandler("POST", async (req, res) => {
	const token = jwtTokenFromRequest(req, res);

	killSession(req, res);

	if (token !== null) {
		await addJwtToBlacklist(token);
	}

	respondSuccess(res);
});
