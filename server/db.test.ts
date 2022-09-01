import { jest } from "@jest/globals";
import { BadRequestError } from "./errors/BadRequestError.js";
import "jest-extended";

/* eslint-disable jest/no-mocks-import */
import * as mockFilesystem from "./database/__mocks__/filesystem.js";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as _mockIo from "./database/__mocks__/io.js"; // FIXME: Using this anywhere causes a nasty loop
import * as mockJwt from "./auth/__mocks__/jwt.js";
/* eslint-enable jest/no-mocks-import */

// See https://github.com/facebook/jest/issues/10025 on why `jest.mock` doesn't work under ESM
jest.unstable_mockModule("./database/filesystem.js", () => mockFilesystem);
jest.unstable_mockModule("./database/io.js", () => ({
	statsForUser: jest.fn(),
	findUserWithProperties: jest.fn(),
	destroyUser: jest.fn(),
	numberOfUsers: jest.fn(),
	upsertUser: jest.fn(),
	deleteDbCollection: jest.fn(),
	deleteDbDoc: jest.fn(),
	deleteDbDocs: jest.fn(),
	fetchDbCollection: jest.fn(),
	fetchDbDoc: jest.fn(),
	fetchDbDocs: jest.fn(),
	upsertDbDocs: jest.fn(),
}));
jest.unstable_mockModule("./auth/jwt.js", () => mockJwt);

const { temporaryFilePath } = await import("./db.js");
const { ensure } = await import("./database/filesystem.js");

const mockEnsure = ensure as jest.Mock;

describe("File path constructor", () => {
	test("Ensures the folder exists", async () => {
		const uid = "real-user";
		const documentId = "some-doc-1234";
		const fileName = "somefile.txt";
		expect(await temporaryFilePath({ uid, documentId, fileName })).toBeString();
		expect(mockEnsure).toHaveBeenCalledOnce();
	});

	test.each`
		fileName            | documentId         | uid              | result
		${"somefile.txt  "} | ${"some-doc-1234"} | ${"real-user  "} | ${"/foo/bar/accountable-attachment-temp/users/real-user/attachments/somefile.txt"}
		${"somefile.txt"}   | ${"some-doc-1234"} | ${"real-user  "} | ${"/foo/bar/accountable-attachment-temp/users/real-user/attachments/somefile.txt"}
		${"somefile.txt  "} | ${"some-doc-1234"} | ${"real-user"}   | ${"/foo/bar/accountable-attachment-temp/users/real-user/attachments/somefile.txt"}
		${"  somefile.txt"} | ${"some-doc-1234"} | ${"  real-user"} | ${"/foo/bar/accountable-attachment-temp/users/real-user/attachments/somefile.txt"}
		${"somefile.txt"}   | ${"some-doc-1234"} | ${"  real-user"} | ${"/foo/bar/accountable-attachment-temp/users/real-user/attachments/somefile.txt"}
		${"  somefile.txt"} | ${"some-doc-1234"} | ${"real-user"}   | ${"/foo/bar/accountable-attachment-temp/users/real-user/attachments/somefile.txt"}
		${"somefile.txt"}   | ${"some-doc-1234"} | ${"real-user"}   | ${"/foo/bar/accountable-attachment-temp/users/real-user/attachments/somefile.txt"}
	`(
		"Returns a path (fileName: '$fileName', documentId: '$documentId', uid: '$uid'",
		async (params: { fileName: string; documentId: string; uid: string; result: string }) => {
			const { fileName, documentId, uid, result } = params;
			expect(await temporaryFilePath({ fileName, documentId, uid })).toBe(result);
		}
	);

	test.each`
		fileName             | documentId         | uid
		${""}                | ${"some-doc-1234"} | ${""}
		${"somefile.txt"}    | ${"some-doc-1234"} | ${".."}
		${"../somefile.txt"} | ${"some-doc-1234"} | ${"not/../real"}
		${"../somefile.txt"} | ${"some-doc-1234"} | ${"real-user"}
		${".."}              | ${"some-doc-1234"} | ${"real-user"}
	`(
		"Throws if the path contains path arguments (fileName: '$fileName', documentId: '$documentId', uid: 'uid')",
		async (params: { fileName: string; documentId: string; uid: string }) => {
			await expect(temporaryFilePath(params)).rejects.toThrow(BadRequestError);
		}
	);
});
