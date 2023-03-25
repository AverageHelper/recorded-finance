import type {
	upsertFileData as _upsertFileData,
	destroyFileData as _destroyFileData,
	addJwtToDatabase as _addJwtToDatabase,
	purgeExpiredJwts as _purgeExpiredJwts,
	upsertUser as _upsertUser,
	destroyUser as _destroyUser,
	upsertDbDocs as _upsertDbDocs,
	deleteDbDocs as _deleteDbDocs,
	deleteDbDoc as _deleteDbDoc,
	deleteDbCollection as _deleteDbCollection,
	deleteDocuments as _deleteDocuments,
	deleteDocument as _deleteDocument,
	deleteCollection as _deleteCollection,
	setDocuments as _setDocuments,
	setDocument as _setDocument,
} from "../write";
import { jest } from "@jest/globals";

export const upsertFileData = jest.fn<typeof _upsertFileData>().mockResolvedValue({ size: 0 });

export const destroyFileData = jest.fn<typeof _destroyFileData>().mockResolvedValue(0);

export const addJwtToDatabase = jest.fn<typeof _addJwtToDatabase>().mockResolvedValue(undefined);

export const purgeExpiredJwts = jest.fn<typeof _purgeExpiredJwts>().mockResolvedValue(undefined);

export const upsertUser = jest.fn<typeof _upsertUser>().mockResolvedValue({ uid: "test_user_123" });

export const destroyUser = jest.fn<typeof _destroyUser>().mockResolvedValue(undefined);

export const upsertDbDocs = jest.fn<typeof _upsertDbDocs>().mockResolvedValue(undefined);

export const deleteDbDocs = jest.fn<typeof _deleteDbDocs>().mockResolvedValue(undefined);

export const deleteDbDoc = jest.fn<typeof _deleteDbDoc>().mockResolvedValue(undefined);

export const deleteDbCollection = jest
	.fn<typeof _deleteDbCollection>()
	.mockResolvedValue(undefined);

export const deleteDocuments = jest.fn<typeof _deleteDocuments>().mockResolvedValue(undefined);

export const deleteDocument = jest.fn<typeof _deleteDocument>().mockResolvedValue(undefined);

export const deleteCollection = jest.fn<typeof _deleteCollection>().mockResolvedValue(undefined);

export const setDocuments = jest.fn<typeof _setDocuments>().mockResolvedValue(undefined);

export const setDocument = jest.fn<typeof _setDocument>().mockResolvedValue(undefined);
