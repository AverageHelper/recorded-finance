import type {
	ensure as _ensure,
	getFileContents as _getFileContents,
	getFolderContents as _getFolderContents,
} from "../filesystem.js";
import { jest } from "@jest/globals";

// eslint-disable-next-line deprecation/deprecation
export const ensure = jest.fn<typeof _ensure>().mockResolvedValue(undefined);

// eslint-disable-next-line deprecation/deprecation
export const getFolderContents = jest.fn<typeof _getFolderContents>().mockResolvedValue([]);

// eslint-disable-next-line deprecation/deprecation
export const getFileContents = jest.fn<typeof _getFileContents>().mockResolvedValue("{}");
