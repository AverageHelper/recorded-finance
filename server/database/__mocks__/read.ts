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

export const statsForUser = vi.fn<typeof _statsForUser>();

export const numberOfUsers = vi.fn<typeof _numberOfUsers>();

export const listAllUserIds = vi.fn<typeof _listAllUserIds>();

export const fetchFileData = vi.fn<typeof _fetchFileData>();

export const totalSizeOfFile = vi.fn<typeof _totalSizeOfFile>();

export const totalSizeOfFilesForUser = vi.fn<typeof _totalSizeOfFilesForUser>();

export const countFileBlobsForUser = vi.fn<typeof _countFileBlobsForUser>();

export const jwtExistsInDatabase = vi.fn<typeof _jwtExistsInDatabase>();

export const numberOfExpiredJwts = vi.fn<typeof _numberOfExpiredJwts>();

export const countRecordsInCollection = vi.fn<typeof _countRecordsInCollection>();

export const fetchDbCollection = vi.fn<typeof _fetchDbCollection>();

export const userWithUid = vi.fn<typeof _userWithUid>();

export const userWithAccountId = vi.fn<typeof _userWithAccountId>();

export const fetchDbDoc = vi.fn<typeof _fetchDbDoc>();

export const fetchDbDocs = vi.fn<typeof _fetchDbDocs>();

export const watchUpdatesToDocument = vi.fn<typeof _watchUpdatesToDocument>();

export const watchUpdatesToCollection = vi.fn<typeof _watchUpdatesToCollection>();

export const informWatchersForDocument = vi.fn<typeof _informWatchersForDocument>();

export const informWatchersForCollection = vi.fn<typeof _informWatchersForCollection>();

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
	fetchDbDoc.mockImplementation(ref => Promise.resolve({ ref, data: null }));
	fetchDbDocs.mockImplementation(refs =>
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
