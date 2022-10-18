import { apiHandler, dispatchRequests } from "../../helpers/apiHandler";

export const GET = apiHandler("GET", (req, res) => {
	res.json({ message: "lol" });
});

export default dispatchRequests({ GET });
