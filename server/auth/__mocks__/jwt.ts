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
import { beforeEach, vi } from "vitest";

export const persistentSecret = "wAheb^8v^YV^s6YaeYVW&8tyLa*ce4"; // from the README

export const blacklistHasJwt = vi.fn<typeof _blacklistHasJwt>();

export const addJwtToBlacklist = vi.fn<typeof _addJwtToBlacklist>();

export const DEFAULT_MOCK_ACCESS_TOKEN: string = "deft";

export const DEFAULT_MOCK_PUBNUB_TOKEN = "move" as PubNubToken;

export const newAccessTokens = vi.fn<typeof _newAccessTokens>();

export const setSession = vi.fn<typeof _setSession>();

export const killSession = vi.fn<typeof _killSession>();

export const jwtFromRequest = vi.fn<typeof _jwtFromRequest>();

export const verifyJwt = vi.fn<typeof _verifyJwt>();

beforeEach(() => {
	blacklistHasJwt.mockResolvedValue(false);
	addJwtToBlacklist.mockResolvedValue(undefined);
	newAccessTokens.mockResolvedValue({
		access_token: DEFAULT_MOCK_ACCESS_TOKEN,
		pubnub_token: DEFAULT_MOCK_PUBNUB_TOKEN,
	});
	setSession.mockReturnValue(undefined);
	killSession.mockReturnValue(undefined);
	jwtFromRequest.mockReturnValue(null);
	verifyJwt.mockRejectedValue(new TypeError("This is a test"));
});
