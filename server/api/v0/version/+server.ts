import { assertMethod } from "../../../helpers/assertMethod.js";
import { version } from "../../../version.js";

export function GET(req: APIRequest, res: APIResponse): void {
	assertMethod(req.method, "GET");
	res.json({ message: `Accountable v${version}`, version });
}
