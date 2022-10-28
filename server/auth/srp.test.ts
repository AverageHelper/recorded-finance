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

	describe.skip("matches 1Password sample vectors", () => {
		const I = "alice";
		const P = "password123";
		const H = "sha1";
		const s = bigintFromHex(`BEB25379 D1A8581E B5A72767 3A2441EE`);
		const N = bigintFromHex(`
FFFFFFFF FFFFFFFF C90FDAA2 2168C234 C4C6628B 80DC1CD1 29024E08
8A67CC74 020BBEA6 3B139B22 514A0879 8E3404DD EF9519B3 CD3A431B
302B0A6D F25F1437 4FE1356D 6D51C245 E485B576 625E7EC6 F44C42E9
A637ED6B 0BFF5CB6 F406B7ED EE386BFB 5A899FA5 AE9F2411 7C4B1FE6
49286651 ECE45B3D C2007CB8 A163BF05 98DA4836 1C55D39A 69163FA8
FD24CF5F 83655D23 DCA3AD96 1C62F356 208552BB 9ED52907 7096966D
670C354E 4ABC9804 F1746C08 CA18217C 32905E46 2E36CE3B E39E772C
180E8603 9B2783A2 EC07A28F B5C55DF0 6F4C52C9 DE2BCBF6 95581718
3995497C EA956AE5 15D22618 98FA0510 15728E5A 8AAAC42D AD33170D
04507A33 A85521AB DF1CBA64 ECFB8504 58DBEF0A 8AEA7157 5D060C7D
B3970F85 A6E1E4C7 ABF5AE8C DB0933D7 1E8C94E0 4A25619D CEE3D226
1AD2EE6B F12FFA06 D98A0864 D8760273 3EC86A64 521F2B18 177B200C
BBE11757 7A615D6C 770988C0 BAD946E2 08E24FA0 74E5AB31 43DB5BFC
E0FD108E 4B82D120 A9210801 1A723C12 A787E6D7 88719A10 BDBA5B26
99C32718 6AF4E23C 1A946834 B6150BDA 2583E9CA 2AD44CE8 DBBBC2DB
04DE8EF9 2E8EFC14 1FBECAA6 287C5947 4E6BC05D 99B2964F A090C3A2
233BA186 515BE7ED 1F612970 CEE2D7AF B81BDD76 2170481C D0069127
D5B05AA9 93B4EA98 8D8FDDC1 86FFB7DC 90A6C08F 4DF435C9 34063199
FFFFFFFF FFFFFFFF`);
		const g = 5n;
		const k = bigintFromHex(`4832374a524b354d344e424a584f42434f45544356584a484641`);
		const x = bigintFromHex(`740299d2306764ad9e87f37cd54179e388fd45c85fea3b030eb425d7adcb2773`);
		const v = bigintFromHex(`
7E273DE8 696FFC4F 4E337D05 B4B375BE B0DDE156 9E8FA00A 9886D812
9BADA1F1 822223CA 1A605B53 0E379BA4 729FDC59 F105B478 7E5186F5
C671085A 1447B52A 48CF1970 B4FB6F84 00BBF4CE BFBB1681 52E08AB5
EA53D15C 1AFF87B2 B9DA6E04 E058AD51 CC72BFC9 033B564E 26480D78
E955A5E2 9E7AB245 DB2BE315 E2099AFB`);
		const a = bigintFromHex(`f1ecc95bb29e8a360e9b257d5688c83d503506a6a6eba683f1e06`);
		const b = bigintFromHex(
			`E487CB59 D31AC550 471E81F0 0F6928E0 1DDA08E9 74A004F4 9E61F5D1 05284D20`
		);
		const A = clientPublicValue(a, N, g);
		const B = bigintFromHex(
			`780a5495cbf731d2463fd01d28822e7d9ccf697c4239d5151f85666aa06b3767e0301b54cfad3bd2b526d4d8a1d96492e59c8d8ecddca96b7e288f186155ffa57b50df6bc2103b6004400b797334a22d9dd234b40142a5ab714ea6070d2ed55096049f50efba99862b72f7e7aee51ed71ba6663fff570cc713d456316f3535630e87a245f09b0791c6e687baa65bf2dfb5c17e50c250256cdad4c9851a2484e88326888060ae9578b5a60e0c85143b25f4fb4fca794e266a4359642da085672d6a3b881649a387875685aeb1ae3d809bf7818dcad596c6e29d566ae87c0ad645a0fcc2eb4f066c097670adf48cf0954918fda4dc30588261321d592f890eed87a950d387b48cf6b4a49f9d497323f683091ae6a4efe675d6bfc4393c0c3d54c9adad65b8dd3a7b7e85cd5d31e97bebc8f23b370348dab53903ec5085cbf65de5e5491f417e5bf9953f081e788f36c26cbe00664a1256c4befb00765ea7e432af189521442c186f14442b1957e444426f740f363ebda943da2bb3b18a13e2f41be9cc3ca0a1b111f6983f9b8d0ee0f4b573c6042fbc0ca029821ebe517ed0755a94f42d32b0abef9240af0f37b5fe0e90c4ca83acf91d28a7f3acff5657bf69fdb7747e380b23fd437f637da2f7ebcf8733a69a75715fe3894e1799906b48e3ae818332cf5f9533e7af5a1f065f907c8f31fe778fa2da853e69926fc551d6b3ae`
		);
		const u = bigintFromHex(`dad353365f78590c1857b29f16e3a947df4707868e2dd2d2b4eafd35c8c854a1`);
		const premasterSecret = bigintFromHex(
			`f6bef3d6fa5a08a849bf61041cd5b3185c16aede851c819a3644fa7e918c4da6`
		);

		test("matches u", () => {
			expect(computeU(A, B, N, H)).toBe(u);
		});

		test("matches premaster secret", () => {
			// expect(clientPremasterSecret(a, I, P, { N, g, s, B }, H)).toBe(premasterSecret);
			expect(serverPremasterSecret(b, N, g, v, { A }, H)).toBe(premasterSecret);
		});
	});

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
