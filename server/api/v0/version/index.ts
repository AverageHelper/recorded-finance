import "module-alias/register";
import { apiHandler, dispatchRequests } from "@/helpers/apiHandler";
import { respondMessage } from "@/responses";
import { version } from "@/version";

export const GET = apiHandler("GET", (req, res) => {
	respondMessage(res, `Recorded Finance v${version}`, { version });
});

export default dispatchRequests({ GET });
