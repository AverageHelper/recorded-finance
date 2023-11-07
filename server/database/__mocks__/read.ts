import type {
	statsForUser as _statsForUser,
	numberOfUsers as _numberOfUsers,
	listAllUserIds as _listAllUserIds,
	fetchFileData as _fetchFileData,
	totalSizeOfFile as _totalSizeOfFile,
	totalSizeOfFilesForUser as _totalSizeOfFilesForUser,
	countFileBlobsForUser as _countFileBlobsForUser,
	jwtExistsInDatabase as _jwtExistsInDatabase,
	numberOfExpiredJwts as _numberOfExpiredJwts,
	countRecordsInCollection as _countRecordsInCollection,
	fetchDbCollection as _fetchDbCollection,
	userWithUid as _userWithUid,
	userWithAccountId as _userWithAccountId,
	fetchDbDoc as _fetchDbDoc,
	fetchDbDocs as _fetchDbDocs,
	watchUpdatesToDocument as _watchUpdatesToDocument,
	watchUpdatesToCollection as _watchUpdatesToCollection,
	informWatchersForDocument as _informWatchersForDocument,
	informWatchersForCollection as _informWatchersForCollection,
} from "../read";
import type { DocumentReference } from "../references";
import { beforeEach, vi } from "vitest";

export const statsForUser = vi.fn<
	Parameters<typeof _statsForUser>,
	ReturnType<typeof _statsForUser>
>();

export const numberOfUsers = vi.fn<
	Parameters<typeof _numberOfUsers>,
	ReturnType<typeof _numberOfUsers>
>();

export const listAllUserIds = vi.fn<
	Parameters<typeof _listAllUserIds>,
	ReturnType<typeof _listAllUserIds>
>();

export const fetchFileData = vi.fn<
	Parameters<typeof _fetchFileData>,
	ReturnType<typeof _fetchFileData>
>();

export const totalSizeOfFile = vi.fn<
	Parameters<typeof _totalSizeOfFile>,
	ReturnType<typeof _totalSizeOfFile>
>();

export const totalSizeOfFilesForUser = vi.fn<
	Parameters<typeof _totalSizeOfFilesForUser>,
	ReturnType<typeof _totalSizeOfFilesForUser>
>();

export const countFileBlobsForUser = vi.fn<
	Parameters<typeof _countFileBlobsForUser>,
	ReturnType<typeof _countFileBlobsForUser>
>();

export const jwtExistsInDatabase = vi.fn<
	Parameters<typeof _jwtExistsInDatabase>,
	ReturnType<typeof _jwtExistsInDatabase>
>();

export const numberOfExpiredJwts = vi.fn<
	Parameters<typeof _numberOfExpiredJwts>,
	ReturnType<typeof _numberOfExpiredJwts>
>();

export const countRecordsInCollection = vi.fn<
	Parameters<typeof _countRecordsInCollection>,
	ReturnType<typeof _countRecordsInCollection>
>();

export const fetchDbCollection = vi.fn<
	Parameters<typeof _fetchDbCollection>,
	ReturnType<typeof _fetchDbCollection>
>();

export const userWithUid = vi.fn<
	Parameters<typeof _userWithUid>,
	ReturnType<typeof _userWithUid>
>();

export const userWithAccountId = vi.fn<
	Parameters<typeof _userWithAccountId>,
	ReturnType<typeof _userWithAccountId>
>();

export const fetchDbDoc = vi.fn<Parameters<typeof _fetchDbDoc>, ReturnType<typeof _fetchDbDoc>>();

export const fetchDbDocs = vi.fn<
	Parameters<typeof _fetchDbDocs>,
	ReturnType<typeof _fetchDbDocs>
>();

export const watchUpdatesToDocument = vi.fn<
	Parameters<typeof _watchUpdatesToDocument>,
	ReturnType<typeof _watchUpdatesToDocument>
>();

export const watchUpdatesToCollection = vi.fn<
	Parameters<typeof _watchUpdatesToCollection>,
	ReturnType<typeof _watchUpdatesToCollection>
>();

export const informWatchersForDocument = vi.fn<
	Parameters<typeof _informWatchersForDocument>,
	ReturnType<typeof _informWatchersForDocument>
>();

export const informWatchersForCollection = vi.fn<
	Parameters<typeof _informWatchersForCollection>,
	ReturnType<typeof _informWatchersForCollection>
>();

// FIXME: We can't see `NonEmptyArray` in here for some reason, so we must redefine the type locally
type NonEmptyArray<T> = [T, ...Array<T>];
type ReadonlyNonEmptyArray<T> = readonly [T, ...ReadonlyArray<T>];

beforeEach(() => {
	statsForUser.mockResolvedValue({ totalSpace: 0, usedSpace: 0 });
	numberOfUsers.mockResolvedValue(0);
	listAllUserIds.mockResolvedValue([]);
	fetchFileData.mockResolvedValue(null);
	totalSizeOfFile.mockResolvedValue(null);
	totalSizeOfFilesForUser.mockResolvedValue(0);
	countFileBlobsForUser.mockResolvedValue(0);
	jwtExistsInDatabase.mockResolvedValue(false);
	numberOfExpiredJwts.mockResolvedValue(0);
	countRecordsInCollection.mockResolvedValue(0);
	fetchDbCollection.mockResolvedValue([]);
	userWithUid.mockResolvedValue(null);
	userWithAccountId.mockResolvedValue(null);
	fetchDbDoc.mockImplementation((c, ref) => Promise.resolve({ ref, data: null }));
	fetchDbDocs.mockImplementation((c, refs) =>
		Promise.resolve(
			(refs as ReadonlyNonEmptyArray<DocumentReference>).map(ref => ({
				ref,
				data: null,
			})) as NonEmptyArray<{ ref: DocumentReference; data: null }>
		)
	);
	watchUpdatesToDocument.mockReturnValue(() => undefined);
	watchUpdatesToCollection.mockReturnValue(() => undefined);
	informWatchersForDocument.mockResolvedValue(undefined);
	informWatchersForCollection.mockResolvedValue(undefined);
});
