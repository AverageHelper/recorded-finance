import type { PubNubToken } from "../../database/schemas";
import type {
	publishWriteForRef as _publishWriteForRef,
	newPubNubTokenForUser as _newPubNubTokenForUser,
	revokePubNubToken as _revokePubNubToken,
} from "../pubnub";

export const publishWriteForRef = vi.fn<
	Parameters<typeof _publishWriteForRef>,
	ReturnType<typeof _publishWriteForRef>
>();

export const DEFAULT_MOCK_NEW_TOKEN = "INSECURE_TOKEN" as PubNubToken;

export const newPubNubTokenForUser = vi.fn<
	Parameters<typeof _newPubNubTokenForUser>,
	ReturnType<typeof _newPubNubTokenForUser>
>();

export const revokePubNubToken = vi.fn<
	Parameters<typeof _revokePubNubToken>,
	ReturnType<typeof _revokePubNubToken>
>();

beforeEach(() => {
	publishWriteForRef.mockResolvedValue(undefined);
	newPubNubTokenForUser.mockResolvedValue(DEFAULT_MOCK_NEW_TOKEN);
	revokePubNubToken.mockResolvedValue(undefined);
});
