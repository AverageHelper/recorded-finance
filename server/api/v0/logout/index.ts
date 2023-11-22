import { addJwtToBlacklist, jwtFromRequest, killSession } from "../../../auth/jwt";
import { apiHandler, dispatchRequests } from "../../../helpers/apiHandler";
import { successResponse } from "../../../responses";

const PATH = "/api/v0/logout";

export const POST = apiHandler(PATH, "POST", null, async c => {
	const token = await jwtFromRequest(c);

	await killSession(c);

	if (token !== null) {
		await addJwtToBlacklist(c, token);
	}

	return successResponse(c);
});

export default dispatchRequests(PATH, { POST });
