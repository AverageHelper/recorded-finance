import { assertMethod } from "../../../helpers/assertMethod";

export function GET(req: APIRequest, res: APIResponse): void {
	assertMethod(req.method, "GET");
	res.json({ message: "Pong!" });
}
