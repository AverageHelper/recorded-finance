import { apiHandler, dispatchRequests, newCsrfToken } from "../../../helpers/apiHandler";
import { version } from "../../../version";

export const GET = apiHandler("GET", async (req, res) => {
	const csrf = await newCsrfToken();
	res.json({ message: `Recorded Finance v${version}`, version, csrf });
});

export default dispatchRequests({ GET });
