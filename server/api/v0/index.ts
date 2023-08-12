import "module-alias/register"; // FIXME: Every API endpoint file needs this line before other runtime imports, because Vercel is silly. See https://github.com/vercel/vercel/issues/2832
import { apiHandler, dispatchRequests } from "@/helpers/apiHandler";
import { respondMessage } from "@/responses";

export const GET = apiHandler("GET", (req, res) => {
	respondMessage(res, "lol");
});

export default dispatchRequests({ GET });
