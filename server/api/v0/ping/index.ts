import "module-alias/register";
import { apiHandler, dispatchRequests } from "@/helpers/apiHandler";
import { respondMessage } from "@/responses";

export const GET = apiHandler("GET", (req, res) => {
	respondMessage(res, "Pong!");
});

export default dispatchRequests({ GET });
