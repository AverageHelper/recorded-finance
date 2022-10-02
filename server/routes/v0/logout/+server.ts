import type { Request, Response } from "express";
import { addJwtToBlacklist, jwtTokenFromRequest } from "../../../auth/jwt.js";
import { respondSuccess } from "../../../responses.js";

export function POST(req: Request, res: Response): void {
	const token = jwtTokenFromRequest(req);

	// ** Kill the session
	req.session = null;

	// ** Blacklist the JWT
	if (token !== null) addJwtToBlacklist(token);

	respondSuccess(res);
}
