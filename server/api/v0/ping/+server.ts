import { apiHandler } from "../../../helpers/apiHandler";

export const GET = apiHandler("GET", (req, res) => {
	res.json({ message: "Pong!" });
});
