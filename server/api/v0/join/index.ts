import type { UID, User } from "../../../database/schemas";
import { apiHandler } from "../../../helpers/apiHandler";
import { DuplicateAccountError } from "../../../errors/DuplicateAccountError";
import { generateAESCipherKey, generateHash, generateSalt } from "../../../auth/generators";
import { nonempty, string, type } from "superstruct";
import { maxTotalUsers } from "../../../auth/limits";
import { newAccessTokens, setSession } from "../../../auth/jwt";
import { NotEnoughUserSlotsError } from "../../../errors/NotEnoughUserSlotsError";
import { numberOfUsers, statsForUser, userWithAccountId } from "../../../database/read";
import { successResponse } from "../../../responses";
import { upsertUser } from "../../../database/write";

/**
 * Returns a fresh document ID that is virtually guaranteed
 * not to have been used before.
 */
function newDocumentId(): UID {
	// TODO: Use the database's own UUID or CUID implementation
	return crypto.randomUUID().replace(/-/gu, "") as UID; // remove hyphens
}

const PATH = "/api/v0/join";
const reqBody = type({
	account: nonempty(string()),
	password: nonempty(string()),
});

export const POST = apiHandler(PATH, "POST", reqBody, async c => {
	const { account: givenAccountId, password: givenPassword } = c.req.valid("json");

	// ** Make sure we arent' full
	const limit = maxTotalUsers(c);
	const current = await numberOfUsers(c);
	if (current >= limit) throw new NotEnoughUserSlotsError();

	// ** Check credentials are unused
	const storedUser = await userWithAccountId(c, givenAccountId);
	if (storedUser) {
		throw new DuplicateAccountError();
	}

	// ** Store credentials
	const passwordSalt = await generateSalt();
	const passwordHash = await generateHash(givenPassword, passwordSalt);
	const uid = newDocumentId();
	const pubnubCipherKey = await generateAESCipherKey();
	const user: Required<User> = {
		currentAccountId: givenAccountId,
		mfaRecoverySeed: null,
		passwordHash,
		passwordSalt,
		pubnubCipherKey,
		requiredAddtlAuth: [],
		totpSeed: null,
		uid,
	};
	await upsertUser(c, user);

	// ** Generate an auth token and send it along
	const { access_token, pubnub_token } = await newAccessTokens(c, user, []);
	const { totalSpace, usedSpace } = await statsForUser(c, user.uid);

	await setSession(c, access_token);
	return successResponse(c, {
		access_token,
		pubnub_cipher_key: pubnubCipherKey,
		pubnub_token,
		uid,
		totalSpace,
		usedSpace,
	});
});
