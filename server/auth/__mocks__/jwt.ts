import type { PubNubToken } from "../../database/schemas";
import type {
	blacklistHasJwt as _blacklistHasJwt,
	addJwtToBlacklist as _addJwtToBlacklist,
	newAccessTokens as _newAccessTokens,
	setSession as _setSession,
	killSession as _killSession,
	jwtFromRequest as _jwtFromRequest,
	verifyJwt as _verifyJwt,
} from "../jwt";
import { jest } from "@jest/globals";

export const persistentSecret = "wAheb^8v^YV^s6YaeYVW&8tyLa*ce4"; // from the README

export const blacklistHasJwt = jest.fn<typeof _blacklistHasJwt>().mockResolvedValue(false);

export const addJwtToBlacklist = jest.fn<typeof _addJwtToBlacklist>().mockResolvedValue(undefined);

export const newAccessTokens = jest
	.fn<typeof _newAccessTokens>()
	.mockResolvedValue({ access_token: "deft", pubnub_token: "move" as PubNubToken });

export const setSession = jest.fn<typeof _setSession>();

export const killSession = jest.fn<typeof _killSession>();

export const jwtFromRequest = jest.fn<typeof _jwtFromRequest>().mockReturnValue(null);

export const verifyJwt = jest
	.fn<typeof _verifyJwt>()
	.mockRejectedValue(new TypeError("This is a test"));
