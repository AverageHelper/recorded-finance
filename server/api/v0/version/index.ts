import { apiHandler, dispatchRequests } from "../../../helpers/apiHandler";
import { version } from "../../../version";

export const GET = apiHandler("GET", (req, res) => {
	res.json({ message: `Recorded Finance v${version}`, version });
});

export default dispatchRequests({ GET });
