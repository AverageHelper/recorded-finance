import vectors from "./srp-test-vectors.json";
import {
	assertHashAlgorithm,
	clientPremasterSecret,
	clientPublicValue,
	computeK,
	computeU,
	computeX,
	HASH,
	modExp,
	PAD,
	randomBits,
	serverPremasterSecret,
	serverPublicValue,
	verifier,
} from "./srp";

describe("SRP", () => {
	/**
	 * Converts the given hex-encoded string into a `bigint` value.
	 */
	function bigintFromHex(hex: string): bigint {
		return BigInt(
			`0x${hex}` //
				.replace(/ /gu, "")
				.replace(/\n/gu, "")
				.replace(/\t/gu, "")
		);
	}

	describe("matches Appendix B vectors", () => {
		const I = "alice";
		const P = "password123";
		const H = "sha1";
		const s = bigintFromHex(`BEB25379 D1A8581E B5A72767 3A2441EE`);
		const N = bigintFromHex(`
EEAF0AB9 ADB38DD6 9C33F80A FA8FC5E8 60726187 75FF3C0B 9EA2314C
9C256576 D674DF74 96EA81D3 383B4813 D692C6E0 E0D5D8E2 50B98BE4
8E495C1D 6089DAD1 5DC7D7B4 6154D6B6 CE8EF4AD 69B15D49 82559B29
7BCF1885 C529F566 660E57EC 68EDBC3C 05726CC0 2FD4CBF4 976EAA9A
FD5138FE 8376435B 9FC61D2F C0EB06E3`);
		const g = 2n;
		const k = bigintFromHex(`7556AA04 5AEF2CDD 07ABAF0F 665C3E81 8913186F`);
		const x = bigintFromHex(`94B7555A ABE9127C C58CCF49 93DB6CF8 4D16C124`);
		const v = bigintFromHex(`
7E273DE8 696FFC4F 4E337D05 B4B375BE B0DDE156 9E8FA00A 9886D812
9BADA1F1 822223CA 1A605B53 0E379BA4 729FDC59 F105B478 7E5186F5
C671085A 1447B52A 48CF1970 B4FB6F84 00BBF4CE BFBB1681 52E08AB5
EA53D15C 1AFF87B2 B9DA6E04 E058AD51 CC72BFC9 033B564E 26480D78
E955A5E2 9E7AB245 DB2BE315 E2099AFB`);
		const a = bigintFromHex(
			`60975527 035CF2AD 1989806F 0407210B C81EDC04 E2762A56 AFD529DD DA2D4393`
		);
		const b = bigintFromHex(
			`E487CB59 D31AC550 471E81F0 0F6928E0 1DDA08E9 74A004F4 9E61F5D1 05284D20`
		);
		const A = bigintFromHex(`
61D5E490 F6F1B795 47B0704C 436F523D D0E560F0 C64115BB 72557EC4
4352E890 3211C046 92272D8B 2D1A5358 A2CF1B6E 0BFCF99F 921530EC
8E393561 79EAE45E 42BA92AE ACED8251 71E1E8B9 AF6D9C03 E1327F44
BE087EF0 6530E69F 66615261 EEF54073 CA11CF58 58F0EDFD FE15EFEA
B349EF5D 76988A36 72FAC47B 0769447B`);
		const B = bigintFromHex(`
BD0C6151 2C692C0C B6D041FA 01BB152D 4916A1E7 7AF46AE1 05393011
BAF38964 DC46A067 0DD125B9 5A981652 236F99D9 B681CBF8 7837EC99
6C6DA044 53728610 D0C6DDB5 8B318885 D7D82C7F 8DEB75CE 7BD4FBAA
37089E6F 9C6059F3 88838E7A 00030B33 1EB76840 910440B1 B27AAEAE
EB4012B7 D7665238 A8E3FB00 4B117B58`);
		const u = bigintFromHex(`CE38B959 3487DA98 554ED47D 70A7AE5F 462EF019`);
		const premasterSecret = bigintFromHex(`
B0DC82BA BCF30674 AE450C02 87745E79 90A3381F 63B387AA F271A10D
233861E3 59B48220 F7C4693C 9AE12B0A 6F67809F 0876E2D0 13800D6C
41BB59B6 D5979B5C 00A172B4 A2A5903A 0BDCAF8A 709585EB 2AFAFA8F
3499B200 210DCC1F 10EB3394 3CD67FC8 8A2F39A4 BE5BEC4E C0A3212D
C346D7E4 74B29EDE 8A469FFE CA686E5A`);

		test("matches u", () => {
			expect(computeU(A, B, N, H)).toBe(u);
		});

		test("matches k", () => {
			expect(computeK(N, g, H)).toBe(k);
		});

		test("matches x", () => {
			expect(computeX(s, I, P, H)).toBe(x);
		});

		test("matches v", () => {
			expect(verifier(s, I, P, N, g, H)).toBe(v);
		});

		test("matches A", () => {
			expect(clientPublicValue(a, N, g)).toBe(A);
		});

		test("matches B", () => {
			expect(serverPublicValue(b, v, N, g, H)).toBe(B);
		});

		test("matches premaster secret on client", () => {
			expect(clientPremasterSecret(a, I, P, { N, g, s, B }, H)).toBe(premasterSecret);
		});

		test("matches premaster secret on server", () => {
			expect(serverPremasterSecret(b, N, g, v, { A }, H)).toBe(premasterSecret);
		});
	});

	const testVectors = vectors.testVectors; // .filter(v => v.H !== "blake2b-256");
	describe.each(testVectors)(
		"matches srptools test vectors (hash: $H, prime: $size bits)",
		params => {
			/**
			 * An object whose `string` properties are transformed into `bigint` values.
			 * Ignores properties named in `E`.
			 */
			type Numberified<T extends object, E extends Array<keyof T>> = {
				[K in keyof T]: T[K] extends string ? (Array<K> extends E ? T[K] : bigint) : T[K];
			};

			/**
			 * Replaces the `string` properties of the given object into `bigint` values.
			 * Ignores the properties named in `exceptKeys`.
			 * Ignores properties whose values are not `string` values.
			 */
			function keysToBigInt<T extends object, E extends Array<keyof T>>(
				obj: T,
				exceptKeys: E
			): Numberified<T, E> {
				const result = { ...obj };
				for (const key of Object.keys(result)) {
					// Ignore exempted keys
					if (exceptKeys.includes(key as keyof T)) continue;

					// Transform string values into bigint
					const og = result[key as keyof T];
					if (typeof og === "string") {
						result[key as keyof T] = bigintFromHex(og) as T[keyof T];
					}
				}
				return result as Numberified<T, E>;
			}

			const { H, size, N, g, I, P, s, k, x, v, a, b, A, B, u, S /* TODO: K, M1, M2 */ } =
				keysToBigInt(params, ["H", "I", "P"]);

			// Throw if one of the test algorithms is unknown to us
			assertHashAlgorithm(H);

			// Sanity check that N is the given size
			const Nstr = N.toString(16);
			const byteCount = (Nstr.length / 2) * 8;
			if (byteCount !== size)
				throw new TypeError(`Expected N to be ${size} bytes, but actually is ${byteCount} bytes`);

			// Check that our implementation returns the correct values
			test("matches u", () => {
				expect(computeU(A, B, N, H)).toBe(u);
			});

			test("matches k", () => {
				expect(computeK(N, g, H)).toBe(k);
			});

			test("matches x", () => {
				expect(computeX(s, I, P, H)).toBe(x);
			});

			test("matches v", () => {
				expect(verifier(s, I, P, N, g, H)).toBe(v);
			});

			test("matches A", () => {
				expect(clientPublicValue(a, N, g)).toBe(A);
			});

			test("matches B", () => {
				expect(serverPublicValue(b, v, N, g, H)).toBe(B);
			});

			test("matches premaster secret on client", () => {
				expect(clientPremasterSecret(a, I, P, { N, g, s, B }, H)).toBe(S);
			});

			test("matches premaster secret on server", () => {
				expect(serverPremasterSecret(b, N, g, v, { A }, H)).toBe(S);
			});
		}
	);

	describe("verifies", () => {
		test("good password", () => {
			// Client
			const a = randomBits(256);
			const I = "alice";
			const P = "password1234";

			// Server
			const H = "sha1";
			const N = bigintFromHex(`
EEAF0AB9 ADB38DD6 9C33F80A FA8FC5E8 60726187 75FF3C0B 9EA2314C
9C256576 D674DF74 96EA81D3 383B4813 D692C6E0 E0D5D8E2 50B98BE4
8E495C1D 6089DAD1 5DC7D7B4 6154D6B6 CE8EF4AD 69B15D49 82559B29
7BCF1885 C529F566 660E57EC 68EDBC3C 05726CC0 2FD4CBF4 976EAA9A
FD5138FE 8376435B 9FC61D2F C0EB06E3`);
			const g = 2n;
			const b = randomBits(256);
			const s = randomBits(128);

			// Client
			const v = verifier(s, I, P, N, g, H);
			const A = clientPublicValue(a, N, g);

			// Server
			const B = serverPublicValue(b, v, N, g, H);
			const S_server = serverPremasterSecret(b, N, g, v, { A }, H);

			// Client
			const S_client = clientPremasterSecret(a, I, P, { N, g, s, B }, H);

			expect(S_client).toBe(S_server);

			// TODO: Compute K, M1, M2
		});
	});

	describe("Modular exponentiation", () => {
		test.each([
			[0n, 0n, 1n, 1n],
			[1n, 0n, 1n, 1n],
			[2n, 0n, 1n, 1n],
			[2n, 1n, 2n, 0n],
			[4n, 1n, 2n, 0n],
			[2n, 2n, 2n, 0n],
		])("simple values: %i^%i mod %i = %i", (x, y, N, result) => {
			expect(modExp(x, y, N)).toBe(result);
		});
	});

	describe("Hashing", () => {
		test.each([
			// these values from DuckDuckGo:
			["", bigintFromHex("da39a3ee5e6b4b0d3255bfef95601890afd80709")],
			["test", bigintFromHex("a94a8fe5ccb19ba61c4c0873d391e987982fbbd3")],
			["calculator", bigintFromHex("46237b3d702aad617eae653792a6269e836aa44d")],
		])("SHA1('%s') = %i", (data, result) => {
			expect(HASH("sha1", data)).toBe(result);
		});

		test.each([
			// these values from DuckDuckGo:
			["test", bigintFromHex("928b20366943e2afd11ebc0eae2e53a93bf177a4fcf35bcc64d503704e65e202")],
			[
				"calculator",
				bigintFromHex("25777f7298db3b9b6200b0284d71b9755a5956839b7bc45aa27e1076a1f12012"),
			],
		])("BLAKE2b-256('%s') = %i", (data, result) => {
			expect(HASH("blake2b-256", data)).toBe(result);
		});
	});

	describe("Left-pad", () => {
		test.each([
			[0n, 0n, "0"],
			[5n, 0n, "5"],
			[5n, 16n, "05"],
			[5n, 162098n, "00005"],
			[bigintFromHex("f"), 162098n, "0000f"],
			[bigintFromHex("96"), 162098n, "00096"],
			[bigintFromHex("16f166"), 162098n, "16f166"],
		])("PAD(%i, %i) = '%s'", (x, N, result) => {
			expect(PAD(x, N)).toBe(result);
		});
	});
});
