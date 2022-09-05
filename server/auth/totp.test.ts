import "jest-extended";
import { jest } from "@jest/globals";
import { URL } from "node:url";

/* eslint-disable jest/no-mocks-import */
import * as mockJwt from "./__mocks__/jwt.js";
/* eslint-enable jest/no-mocks-import */

// See https://github.com/facebook/jest/issues/10025 on why `jest.mock` doesn't work under ESM
jest.unstable_mockModule("./jwt.js", () => mockJwt);

const { base32Encode, generateSecret, generateTOTP, generateTOTPSecretURI, verifyTOTP } =
	await import("./totp.js");

describe("TOTP", () => {
	// These values are unique for each user
	const accountId = "bob"; // doesn't matter much, just handy for the URI
	const secret = base32Encode(Buffer.from("the user's special TOTP secret in plaintext"));
	const secretUri = new URL(
		`otpauth://totp/Accountable:${accountId}?algorithm=SHA1&digits=6&issuer=Accountable&period=30&secret=${secret}`
	);

	afterEach(() => {
		jest.useRealTimers();
	});

	test("secret generator throws if the seed is empty", () => {
		expect(() => generateSecret("")).toThrow(TypeError);
	});

	test.each`
		seed                                               | result
		${"lol"}                                           | ${"EG6YIU2W32IYXZ3IKQOLW"}
		${"5"}                                             | ${"E4DLRMP2HY6PFHTT465A4"}
		${"150"}                                           | ${"KGFGZ7F3IW7FHHGKCNIH4"}
		${"151"}                                           | ${"HTBNAS6ILKMCNWOPI2P6G"}
		${"280"}                                           | ${"DXRYCFWFCCGFU4MT5FMXY"}
		${"something extra long, like more than 21 chars"} | ${"UQNCNGNBLI22WVXQG3MXM"}
	`(
		"generates a secret, stable for a given seed",
		({ seed, result }: { seed: string; result: string }) => {
			const secret1 = generateSecret(seed);
			const secret2 = generateSecret(seed);
			expect(secret1).toHaveLength(21);
			expect(secret1).toBe(result);
			expect(secret2).toBe(secret1);
		}
	);

	test.each`
		seed                                               | secret
		${"lol"}                                           | ${"EG6YIU2W32IYXZ3IKQOLW"}
		${"5"}                                             | ${"E4DLRMP2HY6PFHTT465A4"}
		${"150"}                                           | ${"KGFGZ7F3IW7FHHGKCNIH4"}
		${"151"}                                           | ${"HTBNAS6ILKMCNWOPI2P6G"}
		${"280"}                                           | ${"DXRYCFWFCCGFU4MT5FMXY"}
		${"something extra long, like more than 21 chars"} | ${"UQNCNGNBLI22WVXQG3MXM"}
	`(
		"generates a secret URI, stable for a given seed",
		({ seed, secret }: { seed: string; secret: string }) => {
			const uri = new URL(generateTOTPSecretURI(accountId, seed));
			const uri2 = new URL(generateTOTPSecretURI(accountId, seed));
			expect(uri2.href).toBe(uri.href);

			// assert a standard URI of the format described at https://github.com/google/google-authenticator/wiki/Key-Uri-Format

			expect(uri.protocol).toBe("otpauth:");
			expect(uri.hostname).toBe("totp");
			expect(uri.pathname).toBe(`/Accountable:${accountId}`);

			const searchParams = uri.searchParams; // should have no more than the needed params
			expect(Array.from(searchParams.keys())).toHaveLength(5);
			expect(searchParams.get("algorithm")).toBe("SHA1");
			expect(searchParams.get("digits")).toBe("6");
			expect(searchParams.get("issuer")).toBe("Accountable");
			expect(searchParams.get("period")).toBe("30");
			expect(searchParams.get("secret")).toBe(secret);
			// param order doesn't matter
		}
	);

	test("uri generator throws if the seed is empty", () => {
		expect(() => generateTOTPSecretURI("bob", "")).toThrow(TypeError);
	});

	test("uri generator throws if the accountId is empty", () => {
		expect(() => generateTOTPSecretURI("", "lol")).toThrow(TypeError);
	});

	const timesAndTokens = [
		[1662395669000, "236323"], // before change

		[1662395670000, "454045"], // after change
		[1662395680000, "454045"], // middle
		[1662395699000, "454045"], // before change

		[1662395700000, "533745"], // after change
		[1662395712000, "533745"], // middle
		[1662395729000, "533745"], // before change

		[1662395730000, "255632"], // after change
	] as const;

	test.each(timesAndTokens)("generates a new 6-digit TOTP every 30 seconds", (now, totp) => {
		jest.useFakeTimers({ now }); // trick Date.now() into doing what I want
		const value = generateTOTP(secret);
		expect(value).toHaveLength(6);
		expect(value).toBe(totp);
	});

	test.each(timesAndTokens)("returns `true` for a valid TOTP", (now, totp) => {
		jest.useFakeTimers({ now });
		const isValid = verifyTOTP(totp, secret);
		const isValid2 = verifyTOTP(totp, secret);
		const isValidButWithUriSecret = verifyTOTP(totp, secretUri.href);
		expect(isValid).toBeTrue();
		expect(isValid2).toBe(isValid);
		expect(isValidButWithUriSecret).toBe(isValid2);
	});

	test.each`
		totp         | desc
		${"236329"}  | ${"one character changed from valid"}
		${"236393"}  | ${"one character changed from valid"}
		${"236923"}  | ${"one character changed from valid"}
		${"239323"}  | ${"one character changed from valid"}
		${"296323"}  | ${"one character changed from valid"}
		${"936323"}  | ${"one character changed from valid"}
		${"23632"}   | ${"one character shorter than valid"}
		${"2363239"} | ${"one character longer than valid"}
		${"000000"}  | ${"all '0' characters"}
		${"999999"}  | ${"all '9' characters"}
		${"aaaaaa"}  | ${"all 'a' characters"}
		${"      "}  | ${"all ' ' characters"}
		${""}        | ${"no characters"}
	`("returns `false` for an invalid TOTP of $desc", ({ totp }: { totp: string }) => {
		jest.useFakeTimers({ now: timesAndTokens[0][0] }); // valid code is 236323 or timesAndTokens[0][1]
		const isValid = verifyTOTP(totp, secret);
		const isValid2 = verifyTOTP(totp, secret);
		const isValidButWithUriSecret = verifyTOTP(totp, secretUri.href);
		expect(isValid).toBeFalse();
		expect(isValid2).toBe(isValid);
		expect(isValidButWithUriSecret).toBe(isValid2);
	});

	// TODO: Test that isValid is different for different secrets
});
