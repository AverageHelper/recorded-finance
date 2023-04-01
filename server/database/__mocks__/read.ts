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
import { jest } from "@jest/globals";

export const statsForUser = jest.fn<typeof _statsForUser>();

export const numberOfUsers = jest.fn<typeof _numberOfUsers>();

export const listAllUserIds = jest.fn<typeof _listAllUserIds>();

export const fetchFileData = jest.fn<typeof _fetchFileData>();

export const totalSizeOfFile = jest.fn<typeof _totalSizeOfFile>();

export const totalSizeOfFilesForUser = jest.fn<typeof _totalSizeOfFilesForUser>();

export const countFileBlobsForUser = jest.fn<typeof _countFileBlobsForUser>();

export const jwtExistsInDatabase = jest.fn<typeof _jwtExistsInDatabase>();

export const numberOfExpiredJwts = jest.fn<typeof _numberOfExpiredJwts>();

export const countRecordsInCollection = jest.fn<typeof _countRecordsInCollection>();

export const fetchDbCollection = jest.fn<typeof _fetchDbCollection>();

export const userWithUid = jest.fn<typeof _userWithUid>();

export const userWithAccountId = jest.fn<typeof _userWithAccountId>();

export const fetchDbDoc = jest.fn<typeof _fetchDbDoc>();

export const fetchDbDocs = jest.fn<typeof _fetchDbDocs>();

export const watchUpdatesToDocument = jest.fn<typeof _watchUpdatesToDocument>();

export const watchUpdatesToCollection = jest.fn<typeof _watchUpdatesToCollection>();

export const informWatchersForDocument = jest.fn<typeof _informWatchersForDocument>();

export const informWatchersForCollection = jest.fn<typeof _informWatchersForCollection>();

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
	fetchDbDoc.mockRejectedValue(new EvalError("This is a test"));
	fetchDbDocs.mockRejectedValue(new EvalError("This is a test"));
	watchUpdatesToDocument.mockReturnValue(() => undefined);
	watchUpdatesToCollection.mockReturnValue(() => undefined);
	informWatchersForDocument.mockResolvedValue(undefined);
	informWatchersForCollection.mockResolvedValue(undefined);
});
