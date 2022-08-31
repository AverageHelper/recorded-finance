import type {
	deleteItem as _deleteItem,
	ensure as _ensure,
	tmpDir as _tmpDir,
	fileExists as _fileExists,
	getFileContents as _getFileContents,
	moveFile as _moveFile,
} from "../filesystem.js";
import { jest } from "@jest/globals";

export const deleteItem = jest.fn<typeof _deleteItem>().mockResolvedValue(undefined);

export const ensure = jest.fn<typeof _ensure>().mockResolvedValue(undefined);

export const tmpDir = jest.fn<typeof _tmpDir>().mockReturnValue("/foo/bar");

export const fileExists = jest.fn<typeof _fileExists>().mockResolvedValue(false);

export const getFileContents = jest.fn<typeof _getFileContents>().mockResolvedValue("{}");

export const moveFile = jest.fn<typeof _moveFile>().mockResolvedValue(undefined);
