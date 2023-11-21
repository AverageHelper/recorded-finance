import type { UID, User } from "../../../database/schemas";
import { apiHandler, dispatchRequests } from "../../../helpers/apiHandler";
import { BadRequestError } from "../../../errors/BadRequestError";
import { DuplicateAccountError } from "../../../errors/DuplicateAccountError";
import { generateAESCipherKey, generateHash, generateSalt } from "../../../auth/generators";
import { is, type } from "superstruct";
import { MAX_USERS } from "../../../auth/limits";
import { newAccessTokens, setSession } from "../../../auth/jwt";
import { nonemptyString } from "../../../database/schemas";
import { NotEnoughUserSlotsError } from "../../../errors/NotEnoughUserSlotsError";
import { numberOfUsers, statsForUser, userWithAccountId } from "../../../database/read";
import { randomUUID } from "node:crypto";
import { respondSuccess } from "../../../responses";
import { upsertUser } from "../../../database/write";

/**
 * Returns a fresh document ID that is virtually guaranteed
 * not to have been used before.
 */
function newDocumentId(): UID {
	return randomUUID().replace(/-/gu, "") as UID; // remove hyphens
}

export const POST = apiHandler("POST", async (req, res) => {
	const reqBody = type({
		account: nonemptyString,
		password: nonemptyString,
	});

	if (!is(req.body, reqBody)) {
		throw new BadRequestError("Improper parameter types");
	}

	const givenAccountId = req.body.account;
	const givenPassword = req.body.password;

	// ** Make sure we arent' full
	const limit = MAX_USERS;
	const current = await numberOfUsers();
	if (current >= limit) throw new NotEnoughUserSlotsError();

	// ** Check credentials are unused
	const storedUser = await userWithAccountId(givenAccountId);
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
	await upsertUser(user);

	// ** Generate an auth token and send it along
	const { access_token, pubnub_token } = await newAccessTokens(user, []);
	const { totalSpace, usedSpace } = await statsForUser(user.uid);

	setSession(req, res, access_token);
	respondSuccess(res, {
		access_token,
		pubnub_token,
		pubnub_cipher_key: pubnubCipherKey,
		uid,
		totalSpace,
		usedSpace,
	});
});

export default dispatchRequests({ POST });
