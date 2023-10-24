import type {
	AnyData,
	DataItem,
	DocumentWriteBatch,
	Hash,
	Identified,
	IdentifiedDataItem,
	Salt,
	UID,
	UserKeys,
} from "./database/schemas";
import type { DocUpdate } from "./database/write";
import type { FileData } from "@prisma/client";
import type { JWT } from "./auth/jwt";
import "jest-extended";
import { allCollectionIds } from "./database/schemas";
import { CollectionReference, DocumentReference } from "./database/references";
import { setAuth, userWithTotp, userWithoutTotp } from "./test/userMocks";
import { version } from "./version";
import _request from "supertest";
import jsonwebtoken from "jsonwebtoken";

vi.mock("./environment");
vi.mock("./auth/generators");
vi.mock("./auth/jwt");
vi.mock("./auth/pubnub");
vi.mock("./auth/totp");
vi.mock("./database/read");
vi.mock("./database/write");

/* eslint-disable vitest/no-mocks-import */
const mockGenerators = await import("./auth/__mocks__/generators");
const mockJwt = await import("./auth/__mocks__/jwt");
const mockTotp = await import("./auth/__mocks__/totp");
const mockRead = await import("./database/__mocks__/read");
const mockWrite = await import("./database/__mocks__/write");
/* eslint-enable vitest/no-mocks-import */

const { app } = await import("./main");

type HTTPMethod = "HEAD" | "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

// eslint-disable-next-line @typescript-eslint/promise-function-async
function request(method: HTTPMethod, path: string): _request.Test {
	const AllowedHeaders =
		"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version";
	const m = method.toLowerCase() as Lowercase<typeof method>;

	if (m === "options") {
		// CORS doesn't allow any of the security headers
		return _request(app)[m](path);
	}

	// eslint-disable-next-line @typescript-eslint/return-await
	return (
		_request(app)
			[m](path)

			// Headers:

			// ** CORS **
			.expect("Access-Control-Allow-Headers", AllowedHeaders)
			.expect("Access-Control-Allow-Credentials", "true")

			// ** Security **
			.expect("Strict-Transport-Security", "max-age=15552000; includeSubDomains")
			.expect("X-Content-Type-Options", "nosniff")
			.expect(
				"Content-Security-Policy",
				"default-src 'self'; base-uri 'self'; object-src 'none'; script-src-attr 'none'; upgrade-insecure-requests"
			)
			.expect("X-Frame-Options", "SAMEORIGIN")
			.expect("Referrer-Policy", "no-referrer")
			.expect(
				"Permissions-Policy",
				"accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), clipboard-read=(), clipboard-write=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=*, gamepad=(), geolocation=(), gyroscope=(), identity-credentials-get=(), idle-detection=(), interest-cohort=(), keyboard-map=(), local-fonts=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=*, publickey-credentials-create=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), speaker-selection=(), storage-access=(), sync-xhr=(), usb=(), web-share=*, xr-spatial-tracking=()"
			)

			// ** Miscellaneous **
			.expect("Vary", "*")
			.expect("Cache-Control", "no-store")
	);
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

		test("POST answers 400 to missing 'account' and 'password' fields", async () => {
			await request("POST", PATH)
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		test("POST answers 400 to missing 'account'", async () => {
			await request("POST", PATH)
				.send({ password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		test("POST answers 400 to missing 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		test("POST answers 400 to empty 'account'", async () => {
			await request("POST", PATH)
				.send({ account: "", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		test("POST answers 400 to empty 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expectInaction();
		});

		test("POST answers 423 if the server is cannot accept new users", async () => {
			mockRead.numberOfUsers.mockResolvedValueOnce(Number.POSITIVE_INFINITY);
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(423)
				.expect({
					message: "We're full at the moment. Try again later!",
					code: "user-quota-exceeded",
				});
			expectInaction();
		});

		test("POST answers 409 if an account already exists by that name", async () => {
			const account = userWithTotp.currentAccountId;
			mockRead.userWithAccountId.mockResolvedValueOnce(userWithoutTotp);
			await request("POST", PATH)
				.send({ account, password: "nonempty" })
				.expect(409)
				.expect({ message: "An account with that ID already exists", code: "account-conflict" });
			expectInaction();
		});

		test("POST answers 200 for new account", async () => {
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
			expect(mockWrite.upsertUser).toHaveBeenCalledExactlyOnceWith({
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
			setAuth(userWithoutTotp);
			await request("POST", PATH) //
				.send({ token: "123456" })
				.expect(409)
				.expect({
					message: "You do not have a TOTP secret to validate against",
					code: "totp-secret-missing",
				});
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 403 if the token does not match", async () => {
			setAuth(userWithTotp);
			await request("POST", PATH) //
				.send({ token: "123456" })
				.expect(403)
				.expect({
					message: "That code is invalid",
					code: "wrong-mfa-credentials",
				});
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 200 if the token matches", async () => {
			const user = setAuth(userWithTotp);
			await request("POST", PATH)
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
			const user = {
				...userWithTotp,
				requiredAddtlAuth: [], // TOTP not yet set up
			};
			setAuth(user);
			await request("POST", PATH)
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
			expect(mockWrite.upsertUser).toHaveBeenCalledExactlyOnceWith({
				...user,
				mfaRecoverySeed: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN, // FIXME: This is weird. Shouldn't the seed != the token?
				requiredAddtlAuth: ["totp"],
			});
		});

		test("POST answers 200 if the user used their recovery token", async () => {
			const user = setAuth(userWithTotp);
			await request("POST", PATH)
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
			expect(mockWrite.upsertUser).toHaveBeenCalledExactlyOnceWith({
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
			setAuth(userWithTotp);
			await request("GET", PATH)
				.expect(409)
				.expect({ message: "You already have TOTP authentication enabled", code: "totp-conflict" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("GET answers 409 if TOTP already required (they should know the secret)", async () => {
			setAuth(userWithTotp);
			await request("GET", PATH)
				.expect(409)
				.expect({ message: "You already have TOTP authentication enabled", code: "totp-conflict" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("GET answers 200, upserts the user with totpSeed, and sends the plaintext secret", async () => {
			const user = {
				...userWithoutTotp,
				mfaRecoverySeed: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN,
			};
			setAuth(user);
			await request("GET", PATH)
				.expect(200)
				.expect({ secret: mockTotp.DEFAULT_MOCK_OTP_SECUET_URI, message: "Success!" });
			expect(mockWrite.upsertUser).toHaveBeenCalledExactlyOnceWith({
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
			const user = {
				...userWithTotp,
				requiredAddtlAuth: [],
			};
			setAuth(user);
			await request("DELETE", PATH)
				.send({ password: "nonempty", token: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("DELETE answers 403 with bad token", async () => {
			const user = {
				...userWithTotp,
				requiredAddtlAuth: [],
			};
			setAuth(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password succeeds
			await request("DELETE", PATH)
				.send({ password: "nonempty", token: "nonempty" })
				.expect(403)
				.expect({ message: "That code is invalid", code: "wrong-mfa-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		// TODO: Test that recovery token does not work for this

		test("DELETE answers 200 and deletes the user's mfaRecoverySeed and totpSeed, and disables TOTP", async () => {
			const user = setAuth(userWithTotp, ["totp"]);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password succeeds
			mockTotp.verifyTOTP.mockReturnValueOnce(true); // TOTP succeeds
			await request("DELETE", PATH)
				.send({ password: "nonempty", token: "nonempty" })
				.expect(200)
				.expect({ message: "Success!" });
			expect(mockWrite.upsertUser).toHaveBeenCalledExactlyOnceWith({
				...user,
				totpSeed: null,
				mfaRecoverySeed: null,
				requiredAddtlAuth: [], // disables 2FA
			});
		});

		test("DELETE answers 403 with bad password, even if the user has no TOTP", async () => {
			const user = {
				...userWithoutTotp,
				mfaRecoverySeed: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN,
			};
			setAuth(user);
			await request("DELETE", PATH)
				.send({ password: "nonempty", token: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("DELETE answers 200 and does nothing if the user has no TOTP", async () => {
			const user = {
				...userWithoutTotp,
				mfaRecoverySeed: mockGenerators.DEFAULT_MOCK_SECURE_TOKEN,
			};
			setAuth(user);
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
			const user = userWithoutTotp;
			setAuth(userWithoutTotp);
			await request("GET", PATH) //
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

		test("POST answers 200 with no session", async () => {
			// `jwtFromRequest` mock returns null by default
			await request("POST", PATH).expect(200).expect({ message: "Success!" });
			expect(mockJwt.addJwtToBlacklist).not.toHaveBeenCalled();
			expect(mockJwt.killSession).toHaveBeenCalledOnce();
		});

		test("POST answers 200 and blacklists the JWT", async () => {
			const token = "auth-token-12345" as JWT;
			mockJwt.jwtFromRequest.mockReturnValueOnce(token);
			await request("POST", PATH).expect(200).expect({ message: "Success!" });
			expect(mockJwt.addJwtToBlacklist).toHaveBeenCalledExactlyOnceWith(token);
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

		test("POST answers 400 without 'account' or 'password'", async () => {
			await request("POST", PATH)
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'account'", async () => {
			await request("POST", PATH)
				.send({ password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 with empty 'account'", async () => {
			await request("POST", PATH)
				.send({ account: "", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 with empty 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST answers 403 without Cookie or Authorization", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST answers 403 with bad password", async () => {
			const user = userWithoutTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);

			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST answers 200 and destroys the user", async () => {
			const user = userWithoutTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password good

			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(200)
				.expect({ message: "Success!" });
			expect(mockWrite.destroyUser).toHaveBeenCalledExactlyOnceWith(user.uid);
		});

		test("POST answers 403 if TOTP is required and not provided", async () => {
			const user = userWithTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password good

			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(403)
				.expect({ message: "You must provide a TOTP code", code: "missing-mfa-credentials" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 if TOTP is required but value is empty", async () => {
			const user = userWithTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password good

			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", token: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST answers 403 if TOTP does not match", async () => {
			const user = userWithTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password good

			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", token: "123456" })
				.expect(403)
				.expect({ message: "That code is invalid", code: "wrong-mfa-credentials" });
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST answers 200 with valid TOTP and destroys the user", async () => {
			const user = userWithoutTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // password good
			mockTotp.verifyTOTP.mockReturnValueOnce(true); // TOTP good

			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", token: "123456" })
				.expect(200)
				.expect({ message: "Success!" });
			expect(mockWrite.destroyUser).toHaveBeenCalledExactlyOnceWith(user.uid);
		});
	});

	describe("/v0/updatepassword", () => {
		const PATH = "/v0/updatepassword";

		const BadMethods = ["HEAD", "GET", "PUT", "DELETE", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
			expect(mockWrite.destroyUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'account', 'password', or 'newpassword'", async () => {
			await request("POST", PATH)
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'password' or 'newpassword'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'account' or 'newpassword'", async () => {
			await request("POST", PATH)
				.send({ password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'account' or 'password'", async () => {
			await request("POST", PATH)
				.send({ newpassword: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'account'", async () => {
			await request("POST", PATH)
				.send({ password: "nonempty", newpassword: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", newpassword: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'newpassword'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 with empty 'account'", async () => {
			await request("POST", PATH)
				.send({ account: "", password: "nonempty", newpassword: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 with empty 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "", newpassword: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 with empty 'newpassword'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", newpassword: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		// Same as wrong password
		test("POST answers 403 when account is not known", async () => {
			mockRead.userWithAccountId.mockResolvedValueOnce(null);
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", newpassword: "nonempty-again" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		// Same as wrong account
		test("POST answers 403 when password is incorrect", async () => {
			mockRead.userWithAccountId.mockResolvedValueOnce(userWithoutTotp);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(false)); // bad password
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", newpassword: "nonempty-again" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 200 and changes the password hash and salt", async () => {
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
			expect(mockWrite.upsertUser).toHaveBeenCalledExactlyOnceWith({
				...user,
				passwordSalt,
				passwordHash,
			});
		});

		test("POST answers 400 if token is empty", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty", newpassword: "nonempty", token: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 403 if token is required but not provided", async () => {
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

		test("POST answers 403 if token does not match", async () => {
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

		test("POST answers 200 and changes the password hash and salt if token is given and valid", async () => {
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
			expect(mockWrite.upsertUser).toHaveBeenCalledExactlyOnceWith({
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

		test("POST answers 400 without 'account', 'newaccount', or 'password'", async () => {
			await request("POST", PATH)
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'newaccount' or 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'account' or 'newaccount'", async () => {
			await request("POST", PATH)
				.send({ password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'account' or 'password'", async () => {
			await request("POST", PATH)
				.send({ newaccount: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'account'", async () => {
			await request("POST", PATH)
				.send({ newaccount: "nonempty", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'newaccount'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 without 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", newaccount: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 with empty 'account'", async () => {
			await request("POST", PATH)
				.send({ account: "", newaccount: "nonempty", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 with empty 'newaccount'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", newaccount: "", password: "nonempty" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 400 with empty 'password'", async () => {
			await request("POST", PATH)
				.send({ account: "nonempty", newaccount: "nonempty", password: "" })
				.expect(400)
				.expect({ message: "Improper parameter types", code: "unknown" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		// Same as wrong password
		test("POST answers 403 when account is not known", async () => {
			mockRead.userWithAccountId.mockResolvedValueOnce(null);
			await request("POST", PATH)
				.send({ account: "nonempty", newaccount: "nonempty-again", password: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		// Same as wrong account
		test("POST answers 403 when password is incorrect", async () => {
			mockRead.userWithAccountId.mockResolvedValueOnce(userWithoutTotp);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(false)); // bad password
			await request("POST", PATH)
				.send({ account: "nonempty", newaccount: "nonempty-again", password: "nonempty" })
				.expect(403)
				.expect({ message: "Incorrect account ID or passphrase", code: "wrong-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 200 and changes the account ID", async () => {
			const user = userWithoutTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // good password

			const newaccount = "nonempty-again";
			await request("POST", PATH)
				.send({ account: "nonempty", newaccount, password: "nonempty" })
				.expect(200)
				.expect({ message: "Success!" });
			expect(mockWrite.upsertUser).toHaveBeenCalledExactlyOnceWith({
				...user,
				currentAccountId: newaccount,
			});
		});

		test("POST answers 403 if token is required but not provided", async () => {
			const user = userWithTotp;
			mockRead.userWithAccountId.mockResolvedValueOnce(user);
			mockGenerators.compare.mockImplementationOnce(() => Promise.resolve(true)); // good password
			await request("POST", PATH)
				.send({ account: "nonempty", newaccount: "nonempty-again", password: "nonempty" })
				.expect(403)
				.expect({ message: "You must provide a TOTP code", code: "missing-mfa-credentials" });
			expect(mockWrite.upsertUser).not.toHaveBeenCalled();
		});

		test("POST answers 403 if token does not match", async () => {
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

		test("POST answers 200 and changes the password hash and salt if token is given and valid", async () => {
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
			expect(mockWrite.upsertUser).toHaveBeenCalledExactlyOnceWith({
				...user,
				currentAccountId: newaccount,
			});
		});
	});

	describe("/v0/db/users/[uid]", () => {
		function pathForUid(uid: string): string {
			return `/v0/db/users/${uid}`;
		}

		const user = userWithoutTotp;
		const PATH = pathForUid(user.uid);

		const BadMethods = ["HEAD", "GET", "PUT", "DELETE", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
			expect(mockWrite.deleteDocuments).not.toHaveBeenCalled();
			expect(mockWrite.setDocuments).not.toHaveBeenCalled();
		});

		test("POST answers 403 if the user is not authenticated", async () => {
			await request("POST", PATH)
				.expect(403)
				.expect({ message: "Unauthorized", code: "missing-token" });
			expect(mockWrite.deleteDocuments).not.toHaveBeenCalled();
			expect(mockWrite.setDocuments).not.toHaveBeenCalled();
		});

		test("POST answers 403 if the UID path doesn't match the authenticated user", async () => {
			setAuth(userWithoutTotp);
			const PATH = pathForUid("someone-else");
			await request("POST", PATH)
				.expect(403)
				.expect({ message: "Unauthorized", code: "not-owner" });
			expect(mockWrite.deleteDocuments).not.toHaveBeenCalled();
			expect(mockWrite.setDocuments).not.toHaveBeenCalled();
		});

		test("POST answers 400 if the body is not an array of write batches", async () => {
			setAuth(userWithoutTotp);
			await request("POST", PATH).send("").expect(400);
			await request("POST", PATH).send('""').expect(400);
			await request("POST", PATH).send("0").expect(400);
			await request("POST", PATH).send("42").expect(400);
			await request("POST", PATH).send({}).expect(400);
			expect(mockWrite.deleteDocuments).not.toHaveBeenCalled();
			expect(mockWrite.setDocuments).not.toHaveBeenCalled();
		});

		test("POST answers 200 if the batch is empty", async () => {
			setAuth(userWithoutTotp);
			await request("POST", PATH).send([]).expect(200);
			expect(mockWrite.deleteDocuments).not.toHaveBeenCalled();
			expect(mockWrite.setDocuments).not.toHaveBeenCalled();
		});

		test("POST answers 400 if the batch contains more than 500 ops", async () => {
			setAuth(userWithoutTotp);
			const op: DocumentWriteBatch = {
				type: "delete",
				ref: {
					collectionId: "tags",
					documentId: "tag-1234",
				},
			};
			const batch = new Array<DocumentWriteBatch>(501).fill(op);
			await request("POST", PATH) //
				.send(batch)
				.expect(400)
				.expect({
					message: "Batch operations cannot contain more than 500 documents",
					code: "unknown",
				});
			expect(mockWrite.deleteDocuments).not.toHaveBeenCalled();
			expect(mockWrite.setDocuments).not.toHaveBeenCalled();
		});

		const counts = [1, 2, 5, 250, 499, 500] as const;
		test.each(counts)("POST answers 200 for a batch of %d 'set' operations", async count => {
			const user = setAuth(userWithoutTotp);
			const data = {
				ciphertext: "lol",
				objectType: "lol",
			};
			const ref = new DocumentReference(new CollectionReference(user, "tags"), "tag-1234");
			const updates = new Array<DocUpdate>(count).fill({ data, ref });
			const batch = updates.map<DocumentWriteBatch>(({ ref }) => {
				return {
					type: "set",
					ref: {
						collectionId: ref.parent.id,
						documentId: ref.id,
					},
					data,
				};
			});
			await request("POST", PATH).send(batch).expect(200);
			expect(mockWrite.deleteDocuments).not.toHaveBeenCalled();
			expect(mockWrite.setDocuments).toHaveBeenCalledExactlyOnceWith(updates);
		});

		test.each(counts)("POST answers 200 for a batch of %d 'delete' operations", async count => {
			const user = setAuth(userWithoutTotp);
			const ref = new DocumentReference(new CollectionReference(user, "tags"), "tag-1234");
			const refs = new Array<DocumentReference>(count).fill(ref);
			const batch = refs.map<DocumentWriteBatch>(u => {
				return {
					type: "delete",
					ref: {
						collectionId: u.parent.id,
						documentId: u.id,
					},
				};
			});
			await request("POST", PATH).send(batch).expect(200);
			expect(mockWrite.deleteDocuments).toHaveBeenCalledExactlyOnceWith(refs);
			expect(mockWrite.setDocuments).not.toHaveBeenCalled();
		});

		test("POST answers 200 for a batch of %d mixed operations", async () => {
			setAuth(userWithoutTotp);
			const data = {
				ciphertext: "lol",
				objectType: "lol",
			};
			const batch: Array<DocumentWriteBatch> = [
				{
					type: "delete",
					ref: {
						collectionId: "tags",
						documentId: "tag-1234",
					},
				},
				{
					type: "set",
					ref: {
						collectionId: "tags",
						documentId: "tag-3412",
					},
					data,
				},
				{
					type: "delete",
					ref: {
						collectionId: "tags",
						documentId: "tag-5678",
					},
				},
				{
					type: "set",
					ref: {
						collectionId: "tags",
						documentId: "tag-7856",
					},
					data,
				},
			];
			await request("POST", PATH).send(batch).expect(200);
			expect(mockWrite.deleteDocuments).toHaveBeenCalledOnce();
			expect(mockWrite.setDocuments).toHaveBeenCalledOnce();
		});

		test.each(counts)(
			"POST answers 403 to a batch of %d 'delete' ops if the user has TOTP set up but hasn't used it this session",
			async count => {
				const user = setAuth(userWithTotp);
				const ref = new DocumentReference(new CollectionReference(user, "tags"), "tag-1234");
				const refs = new Array<DocumentReference>(count).fill(ref);
				const batch = refs.map<DocumentWriteBatch>(u => {
					return {
						type: "delete",
						ref: {
							collectionId: u.parent.id,
							documentId: u.id,
						},
					};
				});
				await request("POST", PATH).send(batch).expect(403);
				expect(mockWrite.deleteDocuments).not.toHaveBeenCalled();
				expect(mockWrite.setDocuments).not.toHaveBeenCalled();
			}
		);

		test.each(counts)(
			"POST answers 200 to a batch of %d 'delete' ops if TOTP was provided",
			async count => {
				const user = setAuth(userWithTotp, ["totp"]);
				const ref = new DocumentReference(new CollectionReference(user, "tags"), "tag-1234");
				const refs = new Array<DocumentReference>(count).fill(ref);
				const batch = refs.map<DocumentWriteBatch>(u => {
					return {
						type: "delete",
						ref: {
							collectionId: u.parent.id,
							documentId: u.id,
						},
					};
				});
				await request("POST", PATH).send(batch).expect(200);
				expect(mockWrite.deleteDocuments).toHaveBeenCalledExactlyOnceWith(refs);
				expect(mockWrite.setDocuments).not.toHaveBeenCalled();
			}
		);
	});

	describe("/v0/db/users/[uid]/[coll]", () => {
		function pathForUidColl(uid: string, coll: string): string {
			return `/v0/db/users/${uid}/${coll}`;
		}

		const user = userWithoutTotp;

		test("GET answers 404 for an unknown collection", async () => {
			setAuth(user);
			const path = pathForUidColl(user.uid, "elsewise");
			await request("GET", path)
				.expect(404)
				.expect({ message: "No data found", code: "not-found" });
			expect(mockRead.fetchDbCollection).not.toHaveBeenCalled();
		});

		test('GET answers 404 for the special ".websocket" endpoint', async () => {
			setAuth(user);
			const path = pathForUidColl(user.uid, ".websocket");
			await request("GET", path)
				.expect(404)
				.expect({ message: "No data found", code: "not-found" });
			expect(mockRead.fetchDbCollection).not.toHaveBeenCalled();
		});

		test("DELETE answers 200 to an unknown (already gone) collection", async () => {
			setAuth(user);
			const path = pathForUidColl(user.uid, "elsewise");
			await request("DELETE", path)
				.expect(200)
				.expect({ message: "Success!", totalSpace: 0, usedSpace: 0 });
			expect(mockWrite.deleteCollection).not.toHaveBeenCalled();
		});
	});

	describe.each(allCollectionIds)("/v0/db/users/[uid]/%s", collectionId => {
		function pathForUid(uid: string): string {
			return `/v0/db/users/${uid}/${collectionId}`;
		}

		const user = userWithoutTotp;
		const PATH = pathForUid(user.uid);

		const BadMethods = ["HEAD", "POST", "PUT", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
			expect(mockRead.fetchDbCollection).not.toHaveBeenCalled();
		});

		test("GET answers 403 if the user is not authenticated", async () => {
			await request("GET", PATH)
				.expect(403)
				.expect({ message: "Unauthorized", code: "missing-token" });
			expect(mockRead.fetchDbCollection).not.toHaveBeenCalled();
		});

		test("GET answers 403 if the caller is not the owner of the data", async () => {
			setAuth(user);
			const path = pathForUid("someone-else");
			await request("GET", path).expect(403).expect({ message: "Unauthorized", code: "not-owner" });
			expect(mockRead.fetchDbCollection).not.toHaveBeenCalled();
		});

		test("GET answers 200 and the empty collection's contents", async () => {
			setAuth(user);
			await request("GET", PATH).expect(200).expect({ message: "Success!", data: [] });
			expect(mockRead.fetchDbCollection).toHaveBeenCalledOnce();
		});

		test("GET answers 200 and the collection's contents", async () => {
			setAuth(user);
			const testDoc: IdentifiedDataItem = {
				_id: "testDoc1",
				ciphertext: "lorem ipsum",
				cryption: "v0",
				objectType: "lol",
			};
			mockRead.fetchDbCollection.mockResolvedValueOnce([testDoc]);
			await request("GET", PATH)
				.expect(200)
				.expect({ message: "Success!", data: [testDoc] });
			expect(mockRead.fetchDbCollection).toHaveBeenCalledOnce();
		});

		test("DELETE answers 403 if the user is not authenticated", async () => {
			await request("DELETE", PATH)
				.expect(403)
				.expect({ message: "Unauthorized", code: "missing-token" });
			expect(mockWrite.deleteCollection).not.toHaveBeenCalled();
		});

		test("DELETE answers 403 if the caller is not the owner of the data", async () => {
			setAuth(user);
			const path = pathForUid("someone-else");
			await request("DELETE", path)
				.expect(403)
				.expect({ message: "Unauthorized", code: "not-owner" });
			expect(mockWrite.deleteCollection).not.toHaveBeenCalled();
		});

		test("DELETE answers 200 and deletes the collection", async () => {
			setAuth(user);
			await request("DELETE", PATH)
				.expect(200)
				.expect({ message: "Success!", totalSpace: 0, usedSpace: 0 });
			expect(mockWrite.deleteCollection).toHaveBeenCalledOnce();
		});
	});

	describe("/v0/db/users/[uid]/[coll]/[doc]", () => {
		function pathForUidCollDoc(uid: string, coll: string, doc: string): string {
			return `/v0/db/users/${uid}/${coll}/${doc}`;
		}

		const user = userWithoutTotp;

		test("GET answers 404 for document in an unknown collection", async () => {
			setAuth(user);
			const path = pathForUidCollDoc(user.uid, "elsewise", "any");
			await request("GET", path)
				.expect(404)
				.expect({ message: "No data found", code: "not-found" });
			expect(mockRead.fetchDbDoc).not.toHaveBeenCalled();
		});

		test.each(allCollectionIds)(
			"GET answers 200 and an empty document for the special \".websocket\" endpoint in the '%s' collection",
			async collectionId => {
				setAuth(user);
				const path = pathForUidCollDoc(user.uid, collectionId, ".websocket");
				await request("GET", path).expect(200).expect({ message: "Success!", data: null });
				expect(mockRead.fetchDbDoc).toHaveBeenCalledOnce();
			}
		);

		test("POST answers 400 if trying to write to an unknown collection", async () => {
			setAuth(user);
			const data: DataItem = {
				ciphertext: "lorem ipsum",
				cryption: "v0",
				objectType: "lol",
			};
			const path = pathForUidCollDoc(user.uid, "elsewise", "any");
			await request("POST", path)
				.send(data)
				.expect(400)
				.expect({ message: "Invalid data", code: "unknown" });
			expect(mockWrite.setDocument).not.toHaveBeenCalled();
		});

		test("DELETE answers 200 to document in [an unknown (already gone) collection", async () => {
			setAuth(user);
			const path = pathForUidCollDoc(user.uid, "elsewise", "any");
			await request("DELETE", path)
				.expect(200)
				.expect({ message: "Success!", totalSpace: 0, usedSpace: 0 });
			expect(mockWrite.deleteDocument).not.toHaveBeenCalled();
		});

		test.each(allCollectionIds)(
			"DELETE answers 200 to an unknown (already gone) document in the '%s' collection",
			async collectionId => {
				setAuth(user);
				const path = pathForUidCollDoc(user.uid, collectionId, "elsewise");
				await request("DELETE", path)
					.expect(200)
					.expect({ message: "Success!", totalSpace: 0, usedSpace: 0 });
				expect(mockWrite.deleteDocument).toHaveBeenCalledOnce();
			}
		);
	});

	describe.each(allCollectionIds)("/v0/db/users/[uid]/%s/[doc]", collectionId => {
		function pathForUidDoc(uid: string, doc: string): string {
			return `/v0/db/users/${uid}/${collectionId}/${doc}`;
		}

		const user = userWithoutTotp;
		const testDocumentId = "testDoc1";
		const collectionRef: CollectionReference = {
			id: collectionId,
			path: collectionId,
			uid: user.uid,
			user,
		};
		const ref: DocumentReference = {
			id: testDocumentId,
			parent: collectionRef,
			path: `${collectionId}/${testDocumentId}`,
			uid: user.uid,
			user,
		};
		const data: DataItem = {
			ciphertext: "lorem ipsum",
			cryption: "v0",
			objectType: "lol",
		};
		const PATH = pathForUidDoc(user.uid, testDocumentId);

		const BadMethods = ["HEAD", "PUT", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
			expect(mockRead.fetchDbDoc).not.toHaveBeenCalled();
		});

		test("GET answers 403 if the user is not authenticated", async () => {
			await request("GET", PATH)
				.expect(403)
				.expect({ message: "Unauthorized", code: "missing-token" });
			expect(mockRead.fetchDbDoc).not.toHaveBeenCalled();
		});

		test("GET answers 403 if the caller is not the owner of the data", async () => {
			setAuth(user);
			const path = pathForUidDoc("someone-else", testDocumentId);
			await request("GET", path).expect(403).expect({ message: "Unauthorized", code: "not-owner" });
			expect(mockRead.fetchDbDoc).not.toHaveBeenCalled();
		});

		test("GET answers 200 and `null` if the document does not exist", async () => {
			setAuth(user);
			mockRead.fetchDbDoc.mockResolvedValueOnce({ ref, data: null });
			await request("GET", PATH).expect(200).expect({ message: "Success!", data: null });
			expect(mockRead.fetchDbDoc).toHaveBeenCalledOnce();
		});

		test("GET answers 200 and the document", async () => {
			setAuth(user);
			const data: Identified<AnyData> = {
				_id: ref.id,
				ciphertext: "lorem ipsum",
				cryption: "v0",
				objectType: "lol",
			};
			mockRead.fetchDbDoc.mockResolvedValueOnce({ ref, data });
			await request("GET", PATH).expect(200).expect({ message: "Success!", data });
			expect(mockRead.fetchDbDoc).toHaveBeenCalledOnce();
		});

		test("POST answers 403 if the user is not authenticated", async () => {
			await request("POST", PATH)
				.send(data)
				.expect(403)
				.expect({ message: "Unauthorized", code: "missing-token" });
			expect(mockWrite.setDocument).not.toHaveBeenCalled();
		});

		test("POST answers 403 if the caller is not the owner of the data ref", async () => {
			setAuth(user);
			const path = pathForUidDoc("someone-else", testDocumentId);
			await request("POST", path)
				.send(data)
				.expect(403)
				.expect({ message: "Unauthorized", code: "not-owner" });
			expect(mockWrite.setDocument).not.toHaveBeenCalled();
		});

		test("POST answers 400 to badly-formatted data", async () => {
			setAuth(user);
			const badData = {};
			await request("POST", PATH)
				.send(badData)
				.expect(400)
				.expect({ message: "Invalid data", code: "unknown" });
			expect(mockWrite.setDocument).not.toHaveBeenCalled();
		});

		test("POST answers 200 and writes the user's data", async () => {
			setAuth(user);
			await request("POST", PATH)
				.send(data)
				.expect(200)
				.expect({ message: "Success!", totalSpace: 0, usedSpace: 0 });
			expect(mockWrite.setDocument).toHaveBeenCalledOnce();
		});

		test("POST answers 200 and writes the user's auth keys", async () => {
			setAuth(user);
			const keys: UserKeys = {
				dekMaterial: "lorem ipsum",
				passSalt: "dolor sit" as Salt,
			};
			await request("POST", PATH)
				.send(keys)
				.expect(200)
				.expect({ message: "Success!", totalSpace: 0, usedSpace: 0 });
			expect(mockWrite.setDocument).toHaveBeenCalledOnce();
		});
	});

	describe("/v0/db/users/[uid]/attachments/[doc]/blob/[key]", () => {
		function pathForUidDocKey(uid: string, doc: string, key: string): string {
			return `/v0/db/users/${uid}/attachments/${doc}/blob/${key}`;
		}

		const user = userWithoutTotp;
		const testDocumentId = "testDoc1";
		const refId = testDocumentId;
		const fileData: FileData = {
			userId: user.uid,
			fileName: "test",
			size: 0,
			contents: Buffer.from("lorem ipsum"),
		};
		const PATH = pathForUidDocKey(user.uid, testDocumentId, testDocumentId);

		const BadMethods = ["HEAD", "PUT", "PATCH"] as const;
		test.each(BadMethods)("%s answers 405", async method => {
			await request(method, PATH).expect(405);
			expect(mockRead.fetchFileData).not.toHaveBeenCalled();
		});

		test("GET answers 403 if the user is not authenticated", async () => {
			await request("GET", PATH)
				.expect(403)
				.expect({ message: "Unauthorized", code: "missing-token" });
			expect(mockRead.fetchFileData).not.toHaveBeenCalled();
		});

		test("GET answers 403 if the caller is not the owner of the data", async () => {
			setAuth(user);
			const path = pathForUidDocKey("someone-else", testDocumentId, testDocumentId);
			await request("GET", path).expect(403).expect({ message: "Unauthorized", code: "not-owner" });
			expect(mockRead.fetchFileData).not.toHaveBeenCalled();
		});

		test("GET answers 404 and `null` if the file does not exist", async () => {
			setAuth(user);
			mockRead.fetchFileData.mockResolvedValueOnce(null);
			await request("GET", PATH)
				.expect(404)
				.expect({ message: "No data found", code: "not-found" });
			expect(mockRead.fetchFileData).toHaveBeenCalledOnce();
		});

		test("GET answers 200 and the file contents", async () => {
			setAuth(user);
			mockRead.fetchFileData.mockResolvedValueOnce(fileData);
			await request("GET", PATH)
				.expect(200)
				.expect({
					message: "Success!",
					// FIXME: We don't return ref.id here, we return the given file path. This is not useful behavior, since the client has this info already. Do something about this in v1?
					data: { _id: refId, contents: fileData.contents.toString("utf8") },
				});
			expect(mockRead.fetchFileData).toHaveBeenCalledOnce();
		});

		test("POST answers 403 if the user is not authenticated", async () => {
			await request("POST", PATH)
				.attach("file", fileData.contents, "foo.json")
				.expect(403)
				.expect({ message: "Unauthorized", code: "missing-token" });
			expect(mockWrite.upsertFileData).not.toHaveBeenCalled();
		});

		test("POST answers 403 if the caller is not the owner of the data ref", async () => {
			setAuth(user);
			const path = pathForUidDocKey("someone-else", testDocumentId, testDocumentId);
			await request("POST", path)
				.attach("file", fileData.contents, "foo.json")
				.expect(403)
				.expect({ message: "Unauthorized", code: "not-owner" });
			expect(mockWrite.upsertFileData).not.toHaveBeenCalled();
		});

		test("POST answers 400 if no file is provided", async () => {
			setAuth(user);
			await request("POST", PATH)
				.expect(400)
				.expect({ message: "You must include a file to store", code: "unknown" });
			expect(mockWrite.upsertFileData).not.toHaveBeenCalled();
		});

		test("POST answers 400 if the filename contains '..'", async () => {
			setAuth(user);
			const path = pathForUidDocKey(user.uid, testDocumentId, "..");
			await request("POST", path) //
				.attach("file", fileData.contents, "foo.json")
				.expect(400)
				.expect({
					message: "fileName cannot contain a '/' character or a parent directory marker",
					code: "unknown",
				});
		});

		test("POST answers 507 if there is insufficient room to store the attachment", async () => {
			setAuth(user);
			await request("POST", PATH) //
				.attach("file", fileData.contents, "foo.json")
				.expect(507)
				.expect({
					message: "There is not enough room to write your data. Delete some stuff first.",
					code: "storage-quota-exceeded",
				});
			expect(mockWrite.upsertFileData).not.toHaveBeenCalled();
		});

		test("POST answers 200 and writes the user's data", async () => {
			setAuth(user);
			mockRead.statsForUser.mockResolvedValueOnce({ usedSpace: 0, totalSpace: 5 });
			await request("POST", PATH)
				.attach("file", fileData.contents, "foo.json")
				.expect(200)
				.expect({ message: "Success!", totalSpace: 0, usedSpace: 0 });
			expect(mockWrite.upsertFileData).toHaveBeenCalledOnce();
		});

		test("DELETE answers 403 if the user is not authenticated", async () => {
			await request("DELETE", PATH)
				.expect(403)
				.expect({ message: "Unauthorized", code: "missing-token" });
			expect(mockWrite.destroyFileData).not.toHaveBeenCalled();
		});

		test("DELETE answers 403 if the user is not the owner of the data ref", async () => {
			setAuth(user);
			const path = pathForUidDocKey("someone-else", testDocumentId, testDocumentId);
			await request("DELETE", path)
				.expect(403)
				.expect({ message: "Unauthorized", code: "not-owner" });
			expect(mockWrite.destroyFileData).not.toHaveBeenCalled();
		});

		test("DELETE answers 200 and destroys the file", async () => {
			setAuth(user);
			await request("DELETE", PATH)
				.expect(200)
				.expect({ message: "Success!", totalSpace: 0, usedSpace: 0 });
			expect(mockWrite.destroyFileData).toHaveBeenCalledOnce();
		});
	});
});
