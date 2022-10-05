import type {
	blacklistHasJwt as _blacklistHasJwt,
	addJwtToBlacklist as _addJwtToBlacklist,
	newAccessToken as _newAccessToken,
	jwtTokenFromRequest as _jwtTokenFromRequest,
	verifyJwt as _verifyJwt,
} from "../jwt.js";
import { jest } from "@jest/globals";

export const persistentSecret = "wAheb^8v^YV^s6YaeYVW&8tyLa*ce4"; // from the README

export const blacklistHasJwt = jest.fn<typeof _blacklistHasJwt>().mockResolvedValue(false);

export const addJwtToBlacklist = jest.fn<typeof _addJwtToBlacklist>().mockResolvedValue(undefined);

export const newAccessToken = jest.fn<typeof _newAccessToken>().mockResolvedValue("deft");

export const jwtTokenFromRequest = jest.fn<typeof _jwtTokenFromRequest>().mockReturnValue(null);

export const verifyJwt = jest
	.fn<typeof _verifyJwt>()
	.mockRejectedValue(new TypeError("This is a test"));
