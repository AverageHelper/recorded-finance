import type {
	statsForUser as _statsForUser,
	numberOfUsers as _numberOfUsers,
	fetchDbCollection as _fetchDbCollection,
	fetchDbDoc as _fetchDbDoc,
	fetchDbDocs as _fetchDbDocs,
	userWithUid as _userWithUid,
	userWithAccountId as _userWithAccountId,
} from "../read";
import { jest } from "@jest/globals";

export const statsForUser = jest
	.fn<typeof _statsForUser>()
	.mockResolvedValue({ totalSpace: 0, usedSpace: 0 });

export const numberOfUsers = jest.fn<typeof _numberOfUsers>().mockResolvedValue(0);

export const fetchDbCollection = jest.fn<typeof _fetchDbCollection>().mockResolvedValue([]);

export const userWithUid = jest.fn<typeof _userWithUid>().mockResolvedValue(null);

export const userWithAccountId = jest.fn<typeof _userWithAccountId>().mockResolvedValue(null);

export const fetchDbDoc = jest
	.fn<typeof _fetchDbDoc>()
	.mockRejectedValue(new EvalError("This is a test"));

export const fetchDbDocs = jest
	.fn<typeof _fetchDbDocs>()
	.mockRejectedValue(new EvalError("This is a test"));
