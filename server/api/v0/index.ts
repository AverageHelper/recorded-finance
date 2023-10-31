import { apiHandler } from "../../helpers/apiHandler";
import { messageResponse } from "../../responses";

const PATH = "/api/v0";

export const GET = apiHandler(PATH, "GET", null, c => {
	return messageResponse(c, "lol");
});
