import type { Hash, Salt, UID } from "./database/schemas";
import type { JWT } from "./auth/jwt";
import "jest-extended";
import { jest } from "@jest/globals";
import { userWithTotp, userWithoutTotp } from "./test/userMocks";
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
			const account = userWithTotp.currentAccountId;
			mockRead.userWithAccountId.mockResolvedValueOnce(userWithoutTotp);
			await request("POST", PATH)
				.send({ account, password: "nonempty" })
				.expect(409)
				.expect({ message: "An account with that ID already exists", code: "account-conflict" });
			expectInaction();
		});

		test("answers 200 for new account", async () => {
			const account = userWithTotp.currentAccountId;
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
			const user = userWithoutTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			await request("POST", PATH)
				.send({ account: user.currentAccountId, password: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expectInaction();
			expect(mockGenerators.compare).toHaveBeenCalledOnce();
		});

		test("answers 200 when password is correct and TOTP is needed", async () => {
			const user = userWithTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true));
			await request("POST", PATH) //
				.send({ account: user.currentAccountId, password: "nonempty" })
				.expect(200)
				.expect({
					access_token: mockJwt.DEFAULT_MOCK_ACCESS_TOKEN,
					pubnub_cipher_key: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
					pubnub_token: mockJwt.DEFAULT_MOCK_PUBNUB_TOKEN,
					validate: "totp",
					uid: user.uid,
					totalSpace: 0,
					usedSpace: 0,
					message: "Success!",
				});
		});

		test("answers 200 when password is correct and TOTP is not needed", async () => {
			const user = userWithoutTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true));
			await request("POST", PATH) //
				.send({ account: user.currentAccountId, password: "nonempty" })
				.expect(200)
				.expect({
					access_token: mockJwt.DEFAULT_MOCK_ACCESS_TOKEN,
					pubnub_cipher_key: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
					pubnub_token: mockJwt.DEFAULT_MOCK_PUBNUB_TOKEN,
					validate: "none",
					uid: user.uid,
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
			const user = userWithoutTotp;
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid: user.uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce(user);
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
			const user = userWithTotp;
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid: user.uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce(user);
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
			const user = userWithTotp;
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid: user.uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce(user);
			await request("POST", PATH)
				.set("Authorization", `Bearer ${Authorization}`)
				.send({ token: mockTotp.DEFAULT_MOCK_TOTP_CODE })
				.expect(200)
				.expect({
					access_token: mockJwt.DEFAULT_MOCK_ACCESS_TOKEN,
					pubnub_cipher_key: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
					pubnub_token: mockJwt.DEFAULT_MOCK_PUBNUB_TOKEN,
					// recovery_token is not included
					uid: user.uid,
					totalSpace: 0,
					usedSpace: 0,
					message: "Success!",
				});
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 200 and the user's recovery token if the user is finishing TOTP setup", async () => {
			const Authorization = "let-me-in-1234" as JWT;
			const user = {
				...userWithTotp,
				requiredAddtlAuth: [], // TOTP not yet set up
			};
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid: user.uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
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
					uid: user.uid,
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
			const user = userWithTotp;
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid: user.uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce(user);
			await request("POST", PATH)
				.set("Authorization", `Bearer ${Authorization}`)
				.send({ token: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN }) // recovery token
				.expect(200)
				.expect({
					access_token: mockJwt.DEFAULT_MOCK_ACCESS_TOKEN,
					pubnub_cipher_key: mockGenerators.DEFAULT_MOCK_AES_CIPHER_KEY,
					pubnub_token: mockJwt.DEFAULT_MOCK_PUBNUB_TOKEN,
					uid: user.uid,
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

	describe("/v0/totp/secret", () => {
		const PATH = "/v0/totp/secret";

		const BadMethods = ["HEAD", "POST", "PUT", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("GET answers 403 if no session", async () => {
			await request("GET", PATH).expect(403);
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("GET answers 409 if the user already used TOTP this session (they know their secret)", async () => {
			const Authorization = "let-me-in-1234" as JWT;
			const user = userWithTotp;
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid: user.uid,
				validatedWithMfa: ["totp"],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce(user);
			await request("GET", PATH)
				.set("Authorization", `Bearer ${Authorization}`)
				.expect(409)
				.expect({ message: "You already have TOTP authentication enabled", code: "totp-conflict" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("GET answers 409 if TOTP already required (they should know the secret)", async () => {
			const Authorization = "let-me-in-1234" as JWT;
			const user = userWithTotp;
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid: user.uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce(user);
			await request("GET", PATH)
				.set("Authorization", `Bearer ${Authorization}`)
				.expect(409)
				.expect({ message: "You already have TOTP authentication enabled", code: "totp-conflict" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("GET answers 200, upserts the user with totpSeed, and sends the plaintext secret", async () => {
			const Authorization = "let-me-in-1234" as JWT;
			const user = {
				...userWithoutTotp,
				mfaRecoverySeed: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN,
			};
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid: user.uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce(user);
			await request("GET", PATH)
				.set("Authorization", `Bearer ${Authorization}`)
				.expect(200)
				.expect({ secret: mockTotp.DEFAULT_MOCK_OTP_SECUET_URI, message: "Success!" });
			expect(mockWrite.upsertUser).toHaveBeenCalledOnceWith({
				...user,
				totpSeed: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN,
			});
		});

		test("DELETE answers 400 without 'password' and 'token'", async () => {
			await request("DELETE", PATH)
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("DELETE answers 400 without 'password'", async () => {
			await request("DELETE", PATH)
				.send({ token: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("DELETE answers 400 without 'token'", async () => {
			await request("DELETE", PATH)
				.send({ password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("DELETE answers 400 with empty 'token'", async () => {
			await request("DELETE", PATH)
				.send({ password: "nonempty", token: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("DELETE answers 400 with empty 'password'", async () => {
			await request("DELETE", PATH)
				.send({ password: "", token: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("DELETE answers 403 without session", async () => {
			await request("DELETE", PATH)
				.send({ password: "nonempty", token: "nonempty" })
				.expect(403)
				.expect({ message: "Unauthorized", code: "missing-token" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("DELETE answers 403 with bad password", async () => {
			const Authorization = "let-me-in-1234" as JWT;
			const user = {
				...userWithTotp,
				requiredAddtlAuth: [],
			};
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid: user.uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce(user);
			await request("DELETE", PATH)
				.send({ password: "nonempty", token: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("DELETE answers 403 with bad token", async () => {
			const Authorization = "let-me-in-1234" as JWT;
			const user = {
				...userWithTotp,
				requiredAddtlAuth: [],
			};
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid: user.uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password succeeds
			await request("DELETE", PATH)
				.send({ password: "nonempty", token: "nonempty" })
				.expect(403)
				.expect({ message: "That code is invalid", code: "wrong-mfa-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		// TODO: Test that recovery token does not work for this

		test("DELETE answers 200 and deletes the user's mfaRecoverySeed and totpSeed, and disables TOTP", async () => {
			const Authorization = "let-me-in-1234" as JWT;
			const user = userWithTotp;
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid: user.uid,
				validatedWithMfa: ["totp"],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password succeeds
			mockTotp.verifyTOTP.mockReturnValueOnce(true); // TOTP succeeds
			await request("DELETE", PATH)
				.send({ password: "nonempty", token: "nonempty" })
				.expect(200)
				.expect({ message: "Success!" });
			expect(mockWrite.upsertUser).toHaveBeenCalledOnceWith({
				...user,
				totpSeed: null,
				mfaRecoverySeed: null,
				requiredAddtlAuth: [], // disables 2FA
			});
		});

		test("DELETE answers 403 with bad password, even if the user has no TOTP", async () => {
			const Authorization = "let-me-in-1234" as JWT;
			const user = {
				...userWithoutTotp,
				mfaRecoverySeed: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN,
			};
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid: user.uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce(user);
			await request("DELETE", PATH)
				.send({ password: "nonempty", token: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("DELETE answers 200 and does nothing if the user has no TOTP", async () => {
			const Authorization = "let-me-in-1234" as JWT;
			const user = {
				...userWithoutTotp,
				mfaRecoverySeed: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN,
			};
			mockJwt.jwtFromRequest.mockReturnValueOnce(Authorization);
			mockJwt.verifyJwt.mockResolvedValueOnce({
				uid: user.uid,
				validatedWithMfa: [],
				pubnubToken: mockPubnub.DEFAULT_MOCK_NEW_TOKEN,
			});
			mockRead.userWithUid.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password succeeds
			// Doesn't need TOTP, since, you know, the user doesn't even have TOTP lol
			await request("DELETE", PATH)
				.send({ password: "nonempty", token: "nonempty" })
				.expect(200)
				.expect({ message: "Success!" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});
	});

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
			const user = userWithoutTotp;
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
			const user = userWithoutTotp;
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

	describe("/v0/logout", () => {
		const PATH = "/v0/logout";

		const BadMethods = ["HEAD", "GET", "PUT", "DELETE", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
			expect(mockJwt.addJwtToBlacklist).not.toHaveBeenCalled();
			expect(mockJwt.killSession).not.toHaveBeenCalled();
		});

		test("POST responds 200 with no session", async () => {
			// `jwtFromRequest` mock returns null by default
			await request("POST", PATH).expect(200).expect({ message: "Success!" });
			expect(mockJwt.addJwtToBlacklist).not.toHaveBeenCalled();
			expect(mockJwt.killSession).toHaveBeenCalledOnce();
		});

		test("POST respods 200 and blacklists the JWT", async () => {
			const token = "auth-token-12345" as JWT;
			mockJwt.jwtFromRequest.mockReturnValueOnce(token);
			await request("POST", PATH).expect(200).expect({ message: "Success!" });
			expect(mockJwt.addJwtToBlacklist).toHaveBeenCalledOnceWith(token);
			expect(mockJwt.killSession).toHaveBeenCalledOnce();
		});
	});

	describe("/v0/leave", () => {
		const PATH = "/v0/leave";

		const BadMethods = ["HEAD", "GET", "PUT", "DELETE", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'account' or 'password'", async () => {
			await request("POST", PATH)
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'account'", async () => {
			await request("POST", PATH)
				.send({ password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 with empty 'account'", async () => {
			await request("POST", PATH)
				.send({ account: "", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 with empty 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST responds 403 without Cookie or Authorization", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST responds 403 with bad password", async () => {
			const user = userWithoutTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);

			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST responds 200 and destroys the user", async () => {
			const user = userWithoutTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password good

			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(200)
				.expect({ message: "Success!" });
			expect(mockWrite.destroyUser).toHaveBeenCalledOnceWith(user.uid);
		});

		test("POST responds 403 if TOTP is required and not provided", async () => {
			const user = userWithTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password good

			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(403)
				.expect({ message: "You must provide a TOTP code", code: "missing-mfa-credentials" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 if TOTP is required but value is empty", async () => {
			const user = userWithTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password good

			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", token: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST responds 403 if TOTP does not match", async () => {
			const user = userWithTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password good

			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", token: "123456" })
				.expect(403)
				.expect({ message: "That code is invalid", code: "wrong-mfa-credentials" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST responds 200 with valid TOTP and destroys the user", async () => {
			const user = userWithoutTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password good
			mockTotp.verifyTOTP.mockReturnValueOnce(true); // TOTP good

			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", token: "123456" })
				.expect(200)
				.expect({ message: "Success!" });
			expect(mockWrite.destroyUser).toHaveBeenCalledOnceWith(user.uid);
		});
	});

	describe("/v0/updatepassword", () => {
		const PATH = "/v0/updatepassword";

		const BadMethods = ["HEAD", "GET", "PUT", "DELETE", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'account', 'password', or 'newpassword'", async () => {
			await request("POST", PATH)
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'password' or 'newpassword'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'account' or 'newpassword'", async () => {
			await request("POST", PATH)
				.send({ password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'account' or 'password'", async () => {
			await request("POST", PATH)
				.send({ newpassword: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'account'", async () => {
			await request("POST", PATH)
				.send({ password: "nonempty", newpassword: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", newpassword: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'newpassword'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 with empty 'account'", async () => {
			await request("POST", PATH)
				.send({ account: "", password: "nonempty", newpassword: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 with empty 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "", newpassword: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 with empty 'newpassword'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", newpassword: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		// Same as wrong password
		test("POST responds 403 when account is not known", async () => {
			mockRead.userWithAccountId.mockResolvedValueOnce(null);
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", newpassword: "nonempty-again" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		// Same as wrong account
		test("POST responds 403 when password is incorrect", async () => {
			mockRead.userWithAccountId.mockResolvedValueOnce(userWithoutTotp);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(false)); // bad password
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", newpassword: "nonempty-again" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 200 and changes the password hash and salt", async () => {
			const user = userWithoutTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // good password

			const passwordSalt = "newly-generated-salt" as Salt;
			const passwordHash = "newly-generated-hash" as Hash;
			mockGenerators.generateSalt.mockResolvedValueOnce(passwordSalt);
			mockGenerators.generateHash.mockResolvedValueOnce(passwordHash);

			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", newpassword: "nonempty-again" })
				.expect(200)
				.expect({ message: "Success!" });
			expect(mockWrite.upsertUser).toHaveBeenCalledOnceWith({
				...user,
				passwordSalt,
				passwordHash,
			});
		});

		test("POST responds 400 if token is empty", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", newpassword: "nonempty", token: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 403 if token is required but not provided", async () => {
			const user = userWithTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // good password
			await request("POST", PATH)
				.send({
					account: "nonempty",
					password: "nonempty",
					newpassword: "nonempty-again",
				})
				.expect(403)
				.expect({ message: "You must provide a TOTP code", code: "missing-mfa-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 403 if token does not match", async () => {
			const user = userWithTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // good password
			mockTotp.verifyTOTP.mockReturnValueOnce(false); // TOTP fails
			await request("POST", PATH)
				.send({
					account: "nonempty",
					password: "nonempty",
					newpassword: "nonempty-again",
					token: "123456",
				})
				.expect(403)
				.expect({ message: "That code is invalid", code: "wrong-mfa-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 200 and changes the password hash and salt if token is given and valid", async () => {
			const user = userWithoutTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // good password
			mockTotp.verifyTOTP.mockReturnValueOnce(true); // TOTP succeeds

			const passwordSalt = "newly-generated-salt" as Salt;
			const passwordHash = "newly-generated-hash" as Hash;
			mockGenerators.generateSalt.mockResolvedValueOnce(passwordSalt);
			mockGenerators.generateHash.mockResolvedValueOnce(passwordHash);

			await request("POST", PATH)
				.send({
					account: "nonempty",
					password: "nonempty",
					newpassword: "nonempty-again",
					token: "123456",
				})
				.expect(200)
				.expect({ message: "Success!" });
			expect(mockWrite.upsertUser).toHaveBeenCalledOnceWith({
				...user,
				passwordSalt,
				passwordHash,
			});
		});
	});

	describe("/v0/updateaccountid", () => {
		const PATH = "/v0/updateaccountid";

		const BadMethods = ["HEAD", "GET", "PUT", "DELETE", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'account', 'newaccount', or 'password'", async () => {
			await request("POST", PATH)
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'newaccount' or 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'account' or 'newaccount'", async () => {
			await request("POST", PATH)
				.send({ password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'account' or 'password'", async () => {
			await request("POST", PATH)
				.send({ newaccount: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'account'", async () => {
			await request("POST", PATH)
				.send({ newaccount: "nonempty", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'newaccount'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 without 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", newaccount: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 with empty 'account'", async () => {
			await request("POST", PATH)
				.send({ account: "", newaccount: "nonempty", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 with empty 'newaccount'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", newaccount: "", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 400 with empty 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", newaccount: "nonempty", password: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		// Same as wrong password
		test("POST responds 403 when account is not known", async () => {
			mockRead.userWithAccountId.mockResolvedValueOnce(null);
			await request("POST", PATH)
				.send({ account: "nonempty", newaccount: "nonempty-again", password: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		// Same as wrong account
		test("POST responds 403 when password is incorrect", async () => {
			mockRead.userWithAccountId.mockResolvedValueOnce(userWithoutTotp);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(false)); // bad password
			await request("POST", PATH)
				.send({ account: "nonempty", newaccount: "nonempty-again", password: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 200 and changes the account ID", async () => {
			const user = userWithoutTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // good password

			const newaccount = "nonempty-again";
			await request("POST", PATH)
				.send({ account: "nonempty", newaccount, password: "nonempty" })
				.expect(200)
				.expect({ message: "Success!" });
			expect(mockWrite.upsertUser).toHaveBeenCalledOnceWith({
				...user,
				currentAccountId: newaccount,
			});
		});

		test("POST responds 403 if token is required but not provided", async () => {
			const user = userWithTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // good password
			await request("POST", PATH)
				.send({ account: "nonempty", newaccount: "nonempty-again", password: "nonempty" })
				.expect(403)
				.expect({ message: "You must provide a TOTP code", code: "missing-mfa-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 403 if token does not match", async () => {
			const user = userWithTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // good password
			mockTotp.verifyTOTP.mockReturnValueOnce(false); // TOTP fails
			await request("POST", PATH)
				.send({
					account: "nonempty",
					newaccount: "nonempty-again",
					password: "nonempty",
					token: "123456",
				})
				.expect(403)
				.expect({ message: "That code is invalid", code: "wrong-mfa-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST responds 200 and changes the password hash and salt if token is given and valid", async () => {
			const user = userWithoutTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // good password
			mockTotp.verifyTOTP.mockReturnValueOnce(true); // TOTP succeeds

			const newaccount = "nonempty-again";
			await request("POST", PATH)
				.send({
					account: "nonempty",
					newaccount,
					password: "nonempty",
					token: "123456",
				})
				.expect(200)
				.expect({ message: "Success!" });
			expect(mockWrite.upsertUser).toHaveBeenCalledOnceWith({
				...user,
				currentAccountId: newaccount,
			});
		});
	});

	// TODO: /v0/db/users/{uid} (POST)

	// TODO: /v0/db/users/{uid}/{coll} (GET, DELETE)

	// TODO: /v0/db/users/{uid}/{coll}/{doc} (GET, POST, DELETE)

	// TODO: /v0/db/users/{uid}/attachments/{doc}/blob/{key} (GET, POST, DELETE)
});
