import type {
	statsForUser as _statsForUser,
	numberOfUsers as _numberOfUsers,
	fetchDbCollection as _fetchDbCollection,
	fetchDbDoc as _fetchDbDoc,
	fetchDbDocs as _fetchDbDocs,
	upsertUser as _upsertUser,
	destroyUser as _destroyUser,
	upsertDbDocs as _upsertDbDocs,
	deleteDbDocs as _deleteDbDocs,
	deleteDbDoc as _deleteDbDoc,
	deleteDbCollection as _deleteDbCollection,
} from "../io.js";
import { jest } from "@jest/globals";

export const statsForUser = jest
	.fn<typeof _statsForUser>()
	.mockResolvedValue({ totalSpace: 0, usedSpace: 0 });

export const numberOfUsers = jest.fn<typeof _numberOfUsers>().mockResolvedValue(0);

export const fetchDbCollection = jest.fn<typeof _fetchDbCollection>().mockResolvedValue([]);

export const findUserWithProperties = jest.fn<() => Promise<unknown>>().mockResolvedValue(null);

export const fetchDbDoc = jest
	.fn<typeof _fetchDbDoc>()
	.mockRejectedValue(new EvalError("This is a test"));

export const fetchDbDocs = jest
	.fn<typeof _fetchDbDocs>()
	.mockRejectedValue(new EvalError("This is a test"));

export const upsertUser = jest.fn<typeof _upsertUser>().mockResolvedValue(undefined);

export const destroyUser = jest.fn<typeof _destroyUser>().mockResolvedValue(undefined);

export const upsertDbDocs = jest.fn<typeof _upsertDbDocs>().mockResolvedValue(undefined);

export const deleteDbDocs = jest.fn<typeof _deleteDbDocs>().mockResolvedValue(undefined);

export const deleteDbDoc = jest.fn<typeof _deleteDbDoc>().mockResolvedValue(undefined);

export const deleteDbCollection = jest
	.fn<typeof _deleteDbCollection>()
	.mockResolvedValue(undefined);
