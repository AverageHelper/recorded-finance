import type { Request, Response } from "express";
import { addJwtToBlacklist, jwtTokenFromRequest } from "../../../auth/jwt.js";
import { respondSuccess } from "../../../responses.js";

export async function POST(req: Request, res: Response): Promise<void> {
	const token = jwtTokenFromRequest(req);

	// ** Kill the session
	req.session = null;

	// ** Blacklist the JWT
	if (token !== null) await addJwtToBlacklist(token);

	respondSuccess(res);
}
