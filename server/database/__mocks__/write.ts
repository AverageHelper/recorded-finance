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

export const upsertFileData = vi.fn<
	Parameters<typeof _upsertFileData>,
	ReturnType<typeof _upsertFileData>
>();

export const destroyFileData = vi.fn<
	Parameters<typeof _destroyFileData>,
	ReturnType<typeof _destroyFileData>
>();

export const addJwtToDatabase = vi.fn<
	Parameters<typeof _addJwtToDatabase>,
	ReturnType<typeof _addJwtToDatabase>
>();

export const purgeExpiredJwts = vi.fn<
	Parameters<typeof _purgeExpiredJwts>,
	ReturnType<typeof _purgeExpiredJwts>
>();

export const upsertUser = vi.fn<Parameters<typeof _upsertUser>, ReturnType<typeof _upsertUser>>();

export const destroyUser = vi.fn<
	Parameters<typeof _destroyUser>,
	ReturnType<typeof _destroyUser>
>();

export const upsertDbDocs = vi.fn<
	Parameters<typeof _upsertDbDocs>,
	ReturnType<typeof _upsertDbDocs>
>();

export const deleteDbDocs = vi.fn<
	Parameters<typeof _deleteDbDocs>,
	ReturnType<typeof _deleteDbDocs>
>();

export const deleteDbDoc = vi.fn<
	Parameters<typeof _deleteDbDoc>,
	ReturnType<typeof _deleteDbDoc>
>();

export const deleteDbCollection = vi.fn<
	Parameters<typeof _deleteDbCollection>,
	ReturnType<typeof _deleteDbCollection>
>();

export const deleteDocuments = vi.fn<
	Parameters<typeof _deleteDocuments>,
	ReturnType<typeof _deleteDocuments>
>();

export const deleteDocument = vi.fn<
	Parameters<typeof _deleteDocument>,
	ReturnType<typeof _deleteDocument>
>();

export const deleteCollection = vi.fn<
	Parameters<typeof _deleteCollection>,
	ReturnType<typeof _deleteCollection>
>();

export const setDocuments = vi.fn<
	Parameters<typeof _setDocuments>,
	ReturnType<typeof _setDocuments>
>();

export const setDocument = vi.fn<
	Parameters<typeof _setDocument>,
	ReturnType<typeof _setDocument>
>();

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
