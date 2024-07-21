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
import { beforeEach, vi } from "vitest";

export const upsertFileData = vi.fn<typeof _upsertFileData>();

export const destroyFileData = vi.fn<typeof _destroyFileData>();

export const addJwtToDatabase = vi.fn<typeof _addJwtToDatabase>();

export const purgeExpiredJwts = vi.fn<typeof _purgeExpiredJwts>();

export const upsertUser = vi.fn<typeof _upsertUser>();

export const destroyUser = vi.fn<typeof _destroyUser>();

export const upsertDbDocs = vi.fn<typeof _upsertDbDocs>();

export const deleteDbDocs = vi.fn<typeof _deleteDbDocs>();

export const deleteDbDoc = vi.fn<typeof _deleteDbDoc>();

export const deleteDbCollection = vi.fn<typeof _deleteDbCollection>();

export const deleteDocuments = vi.fn<typeof _deleteDocuments>();

export const deleteDocument = vi.fn<typeof _deleteDocument>();

export const deleteCollection = vi.fn<typeof _deleteCollection>();

export const setDocuments = vi.fn<typeof _setDocuments>();

export const setDocument = vi.fn<typeof _setDocument>();

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
