import type { User } from "../../../database/schemas";
import { apiHandler } from "../../../helpers/apiHandler";
import { BadRequestError, DuplicateAccountError, NotEnoughRoomError } from "../../../errors";
import { generateHash, generateSalt } from "../../../auth/generators";
import { is, nonempty, string, type } from "superstruct";
import { MAX_USERS } from "../../../auth/limits";
import { newAccessToken } from "../../../auth/jwt";
import { numberOfUsers, statsForUser, upsertUser, userWithAccountId } from "../../../database/io";
import { respondSuccess } from "../../../responses";
import { v4 as uuid } from "uuid";

/**
 * Returns a fresh document ID that is virtually guaranteed
 * not to have been used before.
 */
function newDocumentId(): string {
	// TODO: Use the database's own UUID or CUID implementation
	return uuid().replace(/-/gu, ""); // remove hyphens
}

export const POST = apiHandler("POST", async (req, res) => {
	const reqBody = type({
		account: nonempty(string()),
		password: nonempty(string()),
	});

	if (!is(req.body, reqBody)) {
		throw new BadRequestError("Improper parameter types");
	}

	const givenAccountId = req.body.account;
	const givenPassword = req.body.password;

	// ** Make sure we arent' full
	const limit = MAX_USERS;
	const current = await numberOfUsers();
	if (current >= limit) throw new NotEnoughRoomError("We're full at the moment. Try again later!");

	// ** Check credentials are unused
	const storedUser = await userWithAccountId(givenAccountId);
	if (storedUser) {
		throw new DuplicateAccountError();
	}

	// ** Store credentials
	const passwordSalt = await generateSalt();
	const passwordHash = await generateHash(givenPassword, passwordSalt);
	const uid = newDocumentId();
	const user: Required<User> = {
		currentAccountId: givenAccountId,
		mfaRecoverySeed: null,
		passwordHash,
		passwordSalt,
		requiredAddtlAuth: [],
		totpSeed: null,
		uid,
	};
	await upsertUser(user);

	// ** Generate an auth token and send it along
	const access_token = await newAccessToken(req, res, user, []);
	const { totalSpace, usedSpace } = await statsForUser(user.uid);
	respondSuccess(res, { access_token, uid, totalSpace, usedSpace });
});

export default POST;
