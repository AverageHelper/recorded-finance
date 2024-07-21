import type { PubNubToken } from "../../database/schemas";
import type {
	publishWriteForRef as _publishWriteForRef,
	newPubNubTokenForUser as _newPubNubTokenForUser,
	revokePubNubToken as _revokePubNubToken,
} from "../pubnub";
import { beforeEach, vi } from "vitest";

export const publishWriteForRef = vi.fn<typeof _publishWriteForRef>();

export const DEFAULT_MOCK_NEW_TOKEN = "INSECURE_TOKEN" as PubNubToken;

export const newPubNubTokenForUser = vi.fn<typeof _newPubNubTokenForUser>();

export const revokePubNubToken = vi.fn<typeof _revokePubNubToken>();

beforeEach(() => {
	publishWriteForRef.mockResolvedValue(undefined);
	newPubNubTokenForUser.mockResolvedValue(DEFAULT_MOCK_NEW_TOKEN);
	revokePubNubToken.mockResolvedValue(undefined);
});
