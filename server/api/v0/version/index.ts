import { apiHandler, dispatchRequests } from "../../../helpers/apiHandler";
import { messageResponse } from "../../../responses";
import { version } from "../../../version";

const PATH = "/api/v0/version";

export const GET = apiHandler(PATH, "GET", null, c => {
	return messageResponse(c, `Recorded Finance Server v${version}`, { version });
});

export default dispatchRequests(PATH, { GET });
