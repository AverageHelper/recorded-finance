import type { Request, Response } from "express";
import { metadataFromRequest } from "../../../auth/requireAuth.js";
import { newAccessToken } from "../../../auth/jwt.js";
import { respondSuccess } from "../../../responses.js";
import { statsForUser } from "../../../database/io.js";

export async function GET(req: Request, res: Response): Promise<void> {
	// ** If the user has the cookie set, respond with a JWT for the user

	const metadata = await metadataFromRequest(req); // throws if bad

	const access_token = await newAccessToken(req, metadata.user, metadata.validatedWithMfa);
	const uid = metadata.user.uid;
	const account = metadata.user.currentAccountId;
	const requiredAddtlAuth = metadata.user.requiredAddtlAuth ?? [];
	const { totalSpace, usedSpace } = await statsForUser(uid);

	respondSuccess(res, {
		account,
		access_token,
		requiredAddtlAuth,
		uid,
		totalSpace,
		usedSpace,
	});
}
