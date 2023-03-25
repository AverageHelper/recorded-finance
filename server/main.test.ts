import type { Hash, Salt, TOTPSeed, UID, User } from "./database/schemas";
import type { JWT } from "./auth/jwt";
import "jest-extended";
import { jest } from "@jest/globals";
import { version } from "./version";
import _request from "supertest";
import jsonwebtoken from "jsonwebtoken";

/* eslint-disable jest/no-mocks-import */
import * as mockEnvironment from "./__mocks__/environment";
import * as mockGenerators from "./auth/__mocks__/generators";
import * as mockJwt from "./auth/__mocks__/jwt";
import * as mockPubnub from "./auth/__mocks__/pubnub";
import * as mockTotp from "./auth/__mocks__/totp";
import * as mockRead from "./database/__mocks__/read";
import * as mockWrite from "./database/__mocks__/write";
/* eslint-enable jest/no-mocks-import */

// See https://github.com/facebook/jest/issues/10025 on why `jest.mock` doesn't work under ESM
jest.unstable_mockModule("./environment", () => mockEnvironment);
jest.unstable_mockModule("./auth/generators", () => mockGenerators);
jest.unstable_mockModule("./auth/jwt", () => mockJwt);
jest.unstable_mockModule("./auth/pubnub", () => mockPubnub);
jest.unstable_mockModule("./auth/totp", () => mockTotp);
jest.unstable_mockModule("./database/read", () => mockRead);
jest.unstable_mockModule("./database/write", () => mockWrite);

const { app } = await import("./main");

type HTTPMethod = "HEAD" | "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

// eslint-disable-next-line @typescript-eslint/promise-function-async
function request(method: HTTPMethod, path: string): _request.Test {
	const AllowedHeaders =
		"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version";
	const m = method.toLowerCase() as Lowercase<typeof method>;

	// eslint-disable-next-line @typescript-eslint/return-await
	return _request(app)
		[m](path)
		.expect("Access-Control-Allow-Headers", AllowedHeaders)
		.expect("Access-Control-Allow-Credentials", "true");
}

describe("Routes", () => {
	describe("unknown path", () => {
		const BadMethods = ["HEAD", "GET", "POST", "PUT", "DELETE", "PATCH"] as const;
		test.each(BadMethods)("%s answers 404", async m => {
			const method = m.toLowerCase() as Lowercase<typeof m>;
			await _request(app) //
				[method]("/nop")
				.expect(404);
		});
	});

	describe("/v0/", () => {
		const PATH = "/v0/";

		// Since all CORS behaviors are the same regardless of path, we'll test them at the root only (for now).

		test("OPTIONS answers CORS headers for request without origin", async () => {
			await request("OPTIONS", PATH).expect(204);
		});

		test("OPTIONS answers 502 for an invalid origin", async () => {
			const Origin = "bad";
			await _request(app) //
				.options(PATH)
				.set("Origin", Origin)
				.expect(502);
			// .expect({ code: "bad-gateway" }); // FIXME: Express hasn't been sending these
		});

		test("OPTIONS answers 502 for an unknown origin", async () => {
			const Origin = "https://www.example.com";
			await _request(app) //
				.options(PATH)
				.set("Origin", Origin)
				.expect(502);
			// .expect({ code: "bad-gateway" }); // FIXME: Express hasn't been sending these
		});

		test("OPTIONS answers CORS headers for valid origin", async () => {
			const Origin = "http://localhost";
			await request("OPTIONS", PATH)
				.set("Origin", Origin)
				.expect("Access-Control-Allow-Origin", Origin)
				.expect(204);
		});

		test("GET answers 200 and sample json", async () => {
			await request("GET", PATH)
				.expect("Content-Type", /json/u)
				.expect(200)
				.expect({ message: "lol" });
		});

		const BadMethods = ["HEAD", "POST", "PUT", "DELETE", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
		});
	});

	describe("/v0/ping", () => {
		const PATH = "/v0/ping";

		test("GET answers 200", async () => {
			await request("GET", PATH)
				.expect("Content-Type", /json/u)
				.expect(200)
				.expect({ message: "Pong!" });
		});

		const BadMethods = ["HEAD", "POST", "PUT", "DELETE", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
		});
	});

	describe("/v0/version", () => {
		const PATH = "/v0/version";

		test("GET answers 200 and the app version", async () => {
			await request("GET", PATH)
				.expect("Content-Type", /json/u)
				.expect(200)
				.expect({ message: `Recorded Finance v${version}`, version });
		});

		const BadMethods = ["HEAD", "POST", "PUT", "DELETE", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
		});
	});

	describe("/v0/join", () => {
		const PATH = "/v0/join";

		function expectInaction(): void {
			expect(mockGenerators.generateSalt).not.toHaveBeenCalled();
			expect(mockGenerators.generateHash).not.toHaveBeenCalled();
			expect(mockGenerators.generateAESCipherKey).not.toHaveBeenCalled();
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		}

		const BadMethods = ["HEAD", "GET", "PUT", "DELETE", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
			expectInaction();
		});

		test("answers 400 to missing 'account' and 'password' fields", async () => {
			await request("POST", PATH)
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		test("answers 400 to missing 'account'", async () => {
			await request("POST", PATH)
				.send({ password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		test("answers 400 to missing 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		test("answers 400 to empty 'account'", async () => {
			await request("POST", PATH)
				.send({ account: "", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		test("answers 400 to empty 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		test("answers 507 if the server is cannot accept new users", async () => {
			mockRead.numberOfUsers.mockResolvedValueOnce(Number.POSITIVE_INFINITY);
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(507)
				.expect({ message: "We're full at the moment. Try again later!", code: "unknown" });
			expectInaction();
		});

		test("answers 409 if an account already exists by that name", async () => {
			const account = "test-user";
			mockRead.userWithAccountId.mockResolvedValueOnce({
				currentAccountId: account,
				passwordHash: "nonempty-hashed" as Hash,
				passwordSalt: "nonempty-salt" as Salt,
				pubnubCipherKey: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
				uid: "test-user-123" as UID,
			});
			await request("POST", PATH)
				.send({ account, password: "nonempty" })
				.expect(409)
				.expect({ message: "An account with that ID already exists", code: "account-conflict" });
			expectInaction();
		});

		test("answers 200 for new account", async () => {
			const account = "test-user";
			const response = await request("POST", PATH)
				.send({ account, password: "nonempty" })
				// .expect("Set-Cookie", /sessionToken/u) // TODO: Separate `setSession` enough that we can check that a cookie was set
				.expect(200);
			expect(response.body).toStrictEqual({
				access_token: mockJwt.DEFAULT_MOCK_ACCESS_TOKEN,
				pubnub_cipher_key: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
				pubnub_token: mockJwt.DEFAULT_MOCK_PUBNUB_TOKEN,
				uid: expect.toBeString() as string, // this is randomly generated
				totalSpace: 0,
				usedSpace: 0,
				message: "Success!",
			});
			expect(mockGenerators.generateSalt).toHaveBeenCalledOnce();
			expect(mockGenerators.generateHash).toHaveBeenCalledOnce();
			expect(mockGenerators.generateAESCipherKey).toHaveBeenCalledOnce();
			expect(mockWrite.upsertUser).toHaveBeenCalledOnceWith({
				uid: expect.toBeString() as UID,
				currentAccountId: account,
				passwordHash: mockGenerators.DEFAULT_MOCK_HASH,
				passwordSalt: mockGenerators.DEFAULT_MOCK_SALT,
				pubnubCipherKey: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
				mfaRecoverySeed: null,
				requiredAddtlAuth: [],
				totpSeed: null,
			});
		});
	});

	describe("/v0/login", () => {
		const PATH = "/v0/login";

		function expectInaction(): void {
			expect(mockJwt.newAccessTokens).not.toHaveBeenCalled();
			expect(mockRead.statsForUser).not.toHaveBeenCalled();
		}

		const BadMethods = ["HEAD", "GET", "PUT", "DELETE", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
		});

		test("answers 400 to missing 'account' and 'password' fields", async () => {
			await request("POST", PATH)
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		test("answers 400 to missing 'account'", async () => {
			await request("POST", PATH)
				.send({ password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		test("answers 400 to missing 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		test("answers 400 to empty 'account'", async () => {
			await request("POST", PATH)
				.send({ account: "", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		test("answers 400 to empty 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		// Same as wrong password
		test("answers 403 when account is not known", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expectInaction();
			expect(mockGenerators.compare).not.toHaveBeenCalled();
		});

		// Same as account doesn't exist
		test("answers 403 when password is not correct", async () => {
			const account = "test-user";
			mockRead.userWithAccountId.mockResolvedValueOnce({
				currentAccountId: account,
				passwordHash: "nonempty-hashed" as Hash,
				passwordSalt: "nonempty-salt" as Salt,
				pubnubCipherKey: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
				uid: "test-user-123" as UID,
			});
			await request("POST", PATH)
				.send({ account, password: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expectInaction();
			expect(mockGenerators.compare).toHaveBeenCalledOnce();
		});

		test("answers 200 when password is correct and TOTP is needed", async () => {
			const account = "test-user";
			const uid = "test-user-123" as UID;
			mockRead.userWithAccountId.mockResolvedValueOnce({
				currentAccountId: account,
				passwordHash: "nonempty-hashed" as Hash,
				passwordSalt: "nonempty-salt" as Salt,
				pubnubCipherKey: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
				uid,
				totpSeed: "seed" as TOTPSeed,
				requiredAddtlAuth: ["totp"],
			});
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true));
			await request("POST", PATH) //
				.send({ account, password: "nonempty" })
				.expect(200)
				.expect({
					access_token: mockJwt.DEFAULT_MOCK_ACCESS_TOKEN,
					pubnub_cipher_key: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
					pubnub_token: mockJwt.DEFAULT_MOCK_PUBNUB_TOKEN,
					validate: "totp",
					uid,
					totalSpace: 0,
					usedSpace: 0,
					message: "Success!",
				});
		});

		test("answers 200 when password is correct and TOTP is not needed", async () => {
			const account = "test-user";
			const uid = "test-user-123" as UID;
			mockRead.userWithAccountId.mockResolvedValueOnce({
				currentAccountId: account,
				passwordHash: "nonempty-hashed" as Hash,
				passwordSalt: "nonempty-salt" as Salt,
				pubnubCipherKey: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
				uid,
			});
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true));
			await request("POST", PATH) //
				.send({ account, password: "nonempty" })
				.expect(200)
				.expect({
					access_token: mockJwt.DEFAULT_MOCK_ACCESS_TOKEN,
					pubnub_cipher_key: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
					pubnub_token: mockJwt.DEFAULT_MOCK_PUBNUB_TOKEN,
					validate: "none",
					uid,
					totalSpace: 0,
					usedSpace: 0,
					message: "Success!",
				});
		});
	});

	describe("/v0/totp/validate", () => {
		const PATH = "/v0/totp/validate";

		const BadMethods = ["HEAD", "GET", "PUT", "DELETE", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 to missing 'token'", async () => {
			await request("POST", PATH)
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 to empty 'token'", async () => {
			await request("POST", PATH)
				.send({ token: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 403 to sessionless request", async () => {
			await request("POST", PATH)
				.send({ token: "123456" })
				.expect(403)
				.expect({ message: "Unauthorized", code: "missing-token" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 409 if the user does not have TOTP 2FA configured", async () => {
			const Authorization = "let-me-in-1234" as JWT;
			const account = "test-user";
			const uid = "test-user-123" as UID;
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce({
				currentAccountId: account,
				passwordHash: "nonempty-hashed" as Hash,
				passwordSalt: "nonempty-salt" as Salt,
				pubnubCipherKey: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
				uid,
			});
			await request("POST", PATH)
				.set("Authorization", `Bearer ${Authorization}`)
				.send({ token: "123456" })
				.expect(409)
				.expect({
					message: "You do not have a TOTP secret to validate against",
					code: "totp-secret-missing",
				});
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 403 if the token does not match", async () => {
			const Authorization = "let-me-in-1234" as JWT;
			const account = "test-user";
			const uid = "test-user-123" as UID;
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce({
				currentAccountId: account,
				passwordHash: "nonempty-hashed" as Hash,
				passwordSalt: "nonempty-salt" as Salt,
				pubnubCipherKey: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
				uid,
				totpSeed: "seed" as TOTPSeed,
				mfaRecoverySeed: "other-seed" as TOTPSeed,
				requiredAddtlAuth: ["totp"],
			});
			await request("POST", PATH)
				.set("Authorization", `Bearer ${Authorization}`)
				.send({ token: "123456" })
				.expect(403)
				.expect({
					message: "That code is invalid",
					code: "wrong-mfa-credentials",
				});
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 200 if the token matches", async () => {
			const Authorization = "let-me-in-1234" as JWT;
			const account = "test-user";
			const uid = "test-user-123" as UID;
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce({
				currentAccountId: account,
				passwordHash: "nonempty-hashed" as Hash,
				passwordSalt: "nonempty-salt" as Salt,
				pubnubCipherKey: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
				uid,
				totpSeed: "seed" as TOTPSeed,
				mfaRecoverySeed: "other-seed" as TOTPSeed,
				requiredAddtlAuth: ["totp"],
			});
			await request("POST", PATH)
				.set("Authorization", `Bearer ${Authorization}`)
				.send({ token: mockTotp.DEFAULT_MOCK_TOTP_CODE })
				.expect(200)
				.expect({
					access_token: mockJwt.DEFAULT_MOCK_ACCESS_TOKEN,
					pubnub_cipher_key: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
					pubnub_token: mockJwt.DEFAULT_MOCK_PUBNUB_TOKEN,
					// recovery_token is not included
					uid,
					totalSpace: 0,
					usedSpace: 0,
					message: "Success!",
				});
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 200 and the user's recovery token if the user is finishing TOTP setup", async () => {
			const Authorization = "let-me-in-1234" as JWT;
			const account = "test-user";
			const uid = "test-user-123" as UID;
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			const user: User = {
				currentAccountId: account,
				passwordHash: "nonempty-hashed" as Hash,
				passwordSalt: "nonempty-salt" as Salt,
				pubnubCipherKey: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
				uid,
				totpSeed: "seed" as TOTPSeed,
				mfaRecoverySeed: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN,
				requiredAddtlAuth: [], // TOTP not yet set up
			};
			mockRead.userWithUid.mockResolvedValueOnce(user);
			await request("POST", PATH)
				.set("Authorization", `Bearer ${Authorization}`)
				.send({ token: mockTotp.DEFAULT_MOCK_TOTP_CODE })
				.expect(200)
				.expect({
					access_token: mockJwt.DEFAULT_MOCK_ACCESS_TOKEN,
					pubnub_cipher_key: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
					pubnub_token: mockJwt.DEFAULT_MOCK_PUBNUB_TOKEN,
					recovery_token: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN, // fresh token!
					uid,
					totalSpace: 0,
					usedSpace: 0,
					message: "Success!",
				});
			expect(mockWrite.upsertUser).toHaveBeenCalledOnceWith({
				...user,
				mfaRecoverySeed: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN, // FIXME: This is weird. Shouldn't the seed != the token?
				requiredAddtlAuth: ["totp"],
			});
		});

		test("POST answers 200 if the user used their recovery token", async () => {
			const Authorization = "let-me-in-1234" as JWT;
			const account = "test-user";
			const uid = "test-user-123" as UID;
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			const user: User = {
				currentAccountId: account,
				passwordHash: "nonempty-hashed" as Hash,
				passwordSalt: "nonempty-salt" as Salt,
				pubnubCipherKey: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
				uid,
				totpSeed: "seed" as TOTPSeed,
				mfaRecoverySeed: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN,
				requiredAddtlAuth: ["totp"],
			};
			mockRead.userWithUid.mockResolvedValueOnce(user);
			await request("POST", PATH)
				.set("Authorization", `Bearer ${Authorization}`)
				.send({ token: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN }) // recovery token
				.expect(200)
				.expect({
					access_token: mockJwt.DEFAULT_MOCK_ACCESS_TOKEN,
					pubnub_cipher_key: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
					pubnub_token: mockJwt.DEFAULT_MOCK_PUBNUB_TOKEN,
					uid,
					totalSpace: 0,
					usedSpace: 0,
					message: "Success!",
				});
			expect(mockWrite.upsertUser).toHaveBeenCalledOnceWith({
				...user,
				mfaRecoverySeed: null,
			});
		});
	});

	// TODO: /v0/totp/secret (GET, DELETE)

	describe("/v0/session", () => {
		const PATH = "/v0/session";

		const BadMethods = ["HEAD", "POST", "PUT", "DELETE", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
		});

		test("GET answers 403 without Cookie or Authorization", async () => {
			await request("GET", PATH)
				.expect("Content-Type", /json/u)
				.expect(403)
				.expect({ message: "Unauthorized", code: "missing-token" });
			expect(mockRead.jwtExistsInDatabase).not.toHaveBeenCalled();
		});

		// TODO: Test `jwtFromRequest` to make sure it can parse a Bearer token, and correctly fails with bad input

		test("GET answers 403 with expired Bearer token", async () => {
			const Authorization = "TEST_EXP" as JWT;
			const user: User = {
				uid: "test-user-123" as UID,
				currentAccountId: "test-account",
				passwordHash: mockGenerators.DEFAULT_MOCK_HASH,
				passwordSalt: mockGenerators.DEFAULT_MOCK_SALT,
				pubnubCipherKey: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
				mfaRecoverySeed: null,
				requiredAddtlAuth: [],
				totpSeed: null,
			};
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockRejectedValueOnce(new jsonwebtoken.JsonWebTokenError("This is a test"));
			mockRead.jwtExistsInDatabase.mockResolvedValueOnce(true);
			mockRead.userWithUid.mockResolvedValueOnce(user);
			await request("GET", PATH)
				.set("Authorization", `Bearer ${Authorization}`)
				.expect("Content-Type", /json/u)
				.expect(403)
				.expect({ message: "You must sign in again in order to proceed", code: "expired-token" });
			expect(mockRead.jwtExistsInDatabase).not.toHaveBeenCalled();
		});

		test("GET answers 200 with valid Bearer token", async () => {
			const Authorization = "Bearer TEST_GOOD" as JWT;
			const user: User = {
				uid: "test-user-123" as UID,
				currentAccountId: "test-account",
				passwordHash: mockGenerators.DEFAULT_MOCK_HASH,
				passwordSalt: mockGenerators.DEFAULT_MOCK_SALT,
				pubnubCipherKey: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
				mfaRecoverySeed: null,
				requiredAddtlAuth: [],
				totpSeed: null,
			};
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid: user.uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.jwtExistsInDatabase.mockResolvedValueOnce(true);
			mockRead.userWithUid.mockResolvedValueOnce(user);
			await request("GET", PATH)
				.set("Authorization", Authorization)
				.expect("Content-Type", /json/u)
				.expect(200)
				.expect({
					account: user.currentAccountId,
					access_token: mockJwt.DEFAULT_MOCK_ACCESS_TOKEN,
					pubnub_cipher_key: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
					pubnub_token: mockJwt.DEFAULT_MOCK_PUBNUB_TOKEN,
					requiredAddtlAuth: [],
					uid: user.uid,
					totalSpace: 0,
					usedSpace: 0,
					message: "Success!",
				});
			expect(mockRead.jwtExistsInDatabase).not.toHaveBeenCalled();
		});
	});

	// TODO: /v0/logout (POST)

	// TODO: /v0/leave (POST)

	// TODO: /v0/updatepassword (POST)

	// TODO: /v0/updateaccountid (POST)

	// TODO: /v0/db/users/{uid} (POST)

	// TODO: /v0/db/users/{uid}/{coll} (GET, DELETE)

	// TODO: /v0/db/users/{uid}/{coll}/{doc} (GET, POST, DELETE)

	// TODO: /v0/db/users/{uid}/attachments/{doc}/blob/{key} (GET, POST, DELETE)
});
