import { addJwtToBlacklist, jwtFromRequest, killSession } from "../../../auth/jwt";
import { apiHandler } from "../../../helpers/apiHandler";
import { respondSuccess } from "../../../responses";

export const POST = apiHandler("POST", async (req, res) => {
	const token = jwtFromRequest(req, res);

	killSession(req, res);

	if (token !== null) {
		await addJwtToBlacklist(token);
	}

	respondSuccess(res);
});

export default POST;
