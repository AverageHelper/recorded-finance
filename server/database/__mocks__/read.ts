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

export const listAllUserIds = jest.fn<typeof _listAllUserIds>().mockResolvedValue([]);

export const fetchFileData = jest.fn<typeof _fetchFileData>().mockResolvedValue(null);

export const totalSizeOfFile = jest.fn<typeof _totalSizeOfFile>().mockResolvedValue(null);

export const totalSizeOfFilesForUser = jest
	.fn<typeof _totalSizeOfFilesForUser>()
	.mockResolvedValue(0);

export const countFileBlobsForUser = jest.fn<typeof _countFileBlobsForUser>().mockResolvedValue(0);

export const jwtExistsInDatabase = jest.fn<typeof _jwtExistsInDatabase>().mockResolvedValue(false);

export const numberOfExpiredJwts = jest.fn<typeof _numberOfExpiredJwts>().mockResolvedValue(0);

export const countRecordsInCollection = jest
	.fn<typeof _countRecordsInCollection>()
	.mockResolvedValue(0);

export const fetchDbCollection = jest.fn<typeof _fetchDbCollection>().mockResolvedValue([]);

export const userWithUid = jest.fn<typeof _userWithUid>().mockResolvedValue(null);

export const userWithAccountId = jest.fn<typeof _userWithAccountId>().mockResolvedValue(null);

export const fetchDbDoc = jest
	.fn<typeof _fetchDbDoc>()
	.mockRejectedValue(new EvalError("This is a test"));

export const fetchDbDocs = jest
	.fn<typeof _fetchDbDocs>()
	.mockRejectedValue(new EvalError("This is a test"));
