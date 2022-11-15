import type {
	upsertUser as _upsertUser,
	destroyUser as _destroyUser,
	upsertDbDocs as _upsertDbDocs,
	deleteDbDocs as _deleteDbDocs,
	deleteDbDoc as _deleteDbDoc,
	deleteDbCollection as _deleteDbCollection,
} from "../write";
import { jest } from "@jest/globals";

export const upsertUser = jest.fn<typeof _upsertUser>().mockResolvedValue({ uid: "test_user_123" });

export const destroyUser = jest.fn<typeof _destroyUser>().mockResolvedValue(undefined);

export const upsertDbDocs = jest.fn<typeof _upsertDbDocs>().mockResolvedValue(undefined);

export const deleteDbDocs = jest.fn<typeof _deleteDbDocs>().mockResolvedValue(undefined);

export const deleteDbDoc = jest.fn<typeof _deleteDbDoc>().mockResolvedValue(undefined);

export const deleteDbCollection = jest
	.fn<typeof _deleteDbCollection>()
	.mockResolvedValue(undefined);
