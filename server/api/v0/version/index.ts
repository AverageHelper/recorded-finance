import { apiHandler, dispatchRequests } from "../../../helpers/apiHandler";
import { version } from "../../../version";

export const GET = apiHandler("GET", (req, res) => {
	res.json({ message: `Accountable v${version}`, version });
});

export default dispatchRequests({ GET });
