import { apiHandler, dispatchRequests, newCsrfToken } from "../../../helpers/apiHandler";
import { respondMessage } from "../../../responses";
import { version } from "../../../version";

export const GET = apiHandler("GET", async (req, res) => {
	const csrf = await newCsrfToken();
	respondMessage(res, `Recorded Finance v${version}`, { version, csrf });
});

export default dispatchRequests({ GET });
