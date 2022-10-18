import { apiHandler, dispatchRequests } from "../../../helpers/apiHandler";

export const GET = apiHandler("GET", (req, res) => {
	res.json({ message: "Pong!" });
});

export default dispatchRequests({ GET });
