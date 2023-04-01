import type { PubNubToken } from "../../database/schemas";
import type {
	publishWriteForRef as _publishWriteForRef,
	newPubNubTokenForUser as _newPubNubTokenForUser,
	revokePubNubToken as _revokePubNubToken,
} from "../pubnub";
import { jest } from "@jest/globals";

export const publishWriteForRef = jest.fn<typeof _publishWriteForRef>();

export const DEFAULT_MOCK_NEW_TOKEN = "INSECURE_TOKEN" as PubNubToken;

export const newPubNubTokenForUser = jest.fn<typeof _newPubNubTokenForUser>();

export const revokePubNubToken = jest.fn<typeof _revokePubNubToken>();

beforeEach(() => {
	publishWriteForRef.mockResolvedValue(undefined);
	newPubNubTokenForUser.mockResolvedValue(DEFAULT_MOCK_NEW_TOKEN);
	revokePubNubToken.mockResolvedValue(undefined);
});
