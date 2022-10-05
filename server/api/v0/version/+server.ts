import { apiHandler } from "../../../helpers/apiHandler.js";
import { version } from "../../../version.js";

export const GET = apiHandler("GET", (req, res) => {
	res.json({ message: `Accountable v${version}`, version });
});
