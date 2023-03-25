import type { PubNubToken } from "../../database/schemas";
import type {
	publishWriteForRef as _publishWriteForRef,
	newPubNubTokenForUser as _newPubNubTokenForUser,
	revokePubNubToken as _revokePubNubToken,
} from "../pubnub";
import { jest } from "@jest/globals";

export const publishWriteForRef = jest
	.fn<typeof _publishWriteForRef>()
	.mockResolvedValue(undefined);

export const DEFAULT_MOCK_NEW_TOKEN = "INSECURE_TOKEN" as PubNubToken;

export const newPubNubTokenForUser = jest
	.fn<typeof _newPubNubTokenForUser>()
	.mockResolvedValue(DEFAULT_MOCK_NEW_TOKEN);

export const revokePubNubToken = jest.fn<typeof _revokePubNubToken>().mockResolvedValue(undefined);
