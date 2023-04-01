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

export const upsertFileData = jest.fn<typeof _upsertFileData>();

export const destroyFileData = jest.fn<typeof _destroyFileData>();

export const addJwtToDatabase = jest.fn<typeof _addJwtToDatabase>();

export const purgeExpiredJwts = jest.fn<typeof _purgeExpiredJwts>();

export const upsertUser = jest.fn<typeof _upsertUser>();

export const destroyUser = jest.fn<typeof _destroyUser>();

export const upsertDbDocs = jest.fn<typeof _upsertDbDocs>();

export const deleteDbDocs = jest.fn<typeof _deleteDbDocs>();

export const deleteDbDoc = jest.fn<typeof _deleteDbDoc>();

export const deleteDbCollection = jest.fn<typeof _deleteDbCollection>();

export const deleteDocuments = jest.fn<typeof _deleteDocuments>();

export const deleteDocument = jest.fn<typeof _deleteDocument>();

export const deleteCollection = jest.fn<typeof _deleteCollection>();

export const setDocuments = jest.fn<typeof _setDocuments>();

export const setDocument = jest.fn<typeof _setDocument>();

beforeEach(() => {
	upsertFileData.mockResolvedValue({ size: 0 });
	destroyFileData.mockResolvedValue(0);
	addJwtToDatabase.mockResolvedValue(undefined);
	purgeExpiredJwts.mockResolvedValue(undefined);
	upsertUser.mockResolvedValue({ uid: "test_user_123" });
	destroyUser.mockResolvedValue(undefined);
	upsertDbDocs.mockResolvedValue(undefined);
	deleteDbDocs.mockResolvedValue(undefined);
	deleteDbDoc.mockResolvedValue(undefined);
	deleteDbCollection.mockResolvedValue(undefined);
	deleteDocuments.mockResolvedValue(undefined);
	deleteDocument.mockResolvedValue(undefined);
	deleteCollection.mockResolvedValue(undefined);
	setDocuments.mockResolvedValue(undefined);
	setDocument.mockResolvedValue(undefined);
});
