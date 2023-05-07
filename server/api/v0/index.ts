import { apiHandler, dispatchRequests } from "@/helpers/apiHandler";
import { respondMessage } from "@/responses";

export const GET = apiHandler("GET", (req, res) => {
	respondMessage(res, "lol");
});

export default dispatchRequests({ GET });
