import type {
	session as _session,
	blacklistHasJwt as _blacklistHasJwt,
	addJwtToBlacklist as _addJwtToBlacklist,
	newAccessToken as _newAccessToken,
	jwtTokenFromRequest as _jwtTokenFromRequest,
	verifyJwt as _verifyJwt,
} from "../jwt.js";
import { jest } from "@jest/globals";

export const session = jest.fn<typeof _session>();

export const blacklistHasJwt = jest.fn<typeof _blacklistHasJwt>().mockReturnValue(false);

export const addJwtToBlacklist = jest.fn<typeof _addJwtToBlacklist>();

export const newAccessToken = jest.fn<typeof _newAccessToken>().mockResolvedValue("deft");

export const jwtTokenFromRequest = jest.fn<typeof _jwtTokenFromRequest>().mockReturnValue(null);

export const verifyJwt = jest
	.fn<typeof _verifyJwt>()
	.mockRejectedValue(new TypeError("This is a test"));
