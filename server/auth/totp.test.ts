import "jest-extended";
import { jest } from "@jest/globals";
import { URL } from "node:url";
import totpGenerator from "totp-generator";

/* eslint-disable jest/no-mocks-import */
import * as mockJwt from "./__mocks__/jwt";
/* eslint-enable jest/no-mocks-import */

// See https://github.com/facebook/jest/issues/10025 on why `jest.mock` doesn't work under ESM
jest.unstable_mockModule("./jwt", () => mockJwt);

const { base32Encode, generateSecret, generateTOTP, generateTOTPSecretURI, verifyTOTP } =
	await import("./totp");

function urlWithNewProtocol(old: URL, newProtocol: string): URL {
	const afterProtocol = old.href.split(":")[1] as string;
	return new URL(`${newProtocol}:${afterProtocol}`);
}

describe("TOTP", () => {
	// These values are unique for each user
	const accountId = "bob"; // doesn't matter much, just handy for the URI
	const secret = base32Encode(Buffer.from("the user's special TOTP secret in plaintext"));
	const secretUri = new URL(
		`otpauth://totp/Accountable:${accountId}?algorithm=SHA1&digits=6&issuer=Accountable&period=30&secret=${secret}`
	);

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
		const value = generateTOTP(secret, { now });
		expect(value).toHaveLength(6);
		expect(value).toBe(totp);
	});

	test.each(timesAndTokens)("returns `true` for a valid TOTP", (now, totp) => {
		const isValid = verifyTOTP(totp, secret, { now });
		const isValid2 = verifyTOTP(totp, secret, { now });
		const isValidButWithUriSecret = verifyTOTP(totp, secretUri.href, { now });
		expect(isValid).toBeTrue();
		expect(isValid2).toBe(isValid);
		expect(isValidButWithUriSecret).toBe(isValid2);
	});

	test("returns `false` if the protocol of the given secret URI is not 'otpauth:'", () => {
		const [now, totp] = timesAndTokens[0]; // these should be valid together
		const badSecret = urlWithNewProtocol(secretUri, "https");
		expect(verifyTOTP(totp, badSecret.href, { now })).toBeFalse();
	});

	test("returns `false` if the given secret URI doesn't have a 'secret' param", () => {
		const [now, totp] = timesAndTokens[0];
		expect(verifyTOTP(totp, secretUri.href, { now })).toBeTrue(); // sanity check

		const badSecret = new URL(secretUri.href);
		badSecret.searchParams.delete("secret");
		expect(verifyTOTP(totp, badSecret.href, { now })).toBeFalse();
	});

	test("returns `false` if the given secret URI's 'secret' param is empty", () => {
		const [now, totp] = timesAndTokens[0];
		expect(verifyTOTP(totp, secretUri.href, { now })).toBeTrue(); // sanity check

		const badSecret = new URL(secretUri.href);
		badSecret.searchParams.set("secret", "");
		expect(verifyTOTP(totp, badSecret.href, { now })).toBeFalse();
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
		const now = timesAndTokens[0][0]; // valid code is 236323 or timesAndTokens[0][1]
		const isValid = verifyTOTP(totp, secret, { now });
		const isValid2 = verifyTOTP(totp, secret, { now });
		const isValidButWithUriSecret = verifyTOTP(totp, secretUri.href, { now });
		expect(isValid).toBeFalse();
		expect(isValid2).toBe(isValid);
		expect(isValidButWithUriSecret).toBe(isValid2);
	});

	test.each(timesAndTokens)("matches a well-known TOTP provider's implementation", now => {
		const value = generateTOTP(secret, { now });
		expect(value).toBe(totpGenerator(secret, { timestamp: now }));
	});

	test.each(timesAndTokens)("uses Date.now() if no timestamp is given", now => {
		jest.useFakeTimers({ now });
		const value = generateTOTP(secret);
		const isValid = verifyTOTP(value, secret);
		expect(value).toBe(totpGenerator(secret));
		expect(isValid).toBeTrue();
		jest.useRealTimers();
	});

	test.each`
		plainSecret                                      | totp
		${"the user's special TOTP secret in plaintext"} | ${"236323"}
		${"secret"}                                      | ${"537346"}
		${"different secret"}                            | ${"216535"}
	`(
		"codes generate differently for different secrets",
		({ plainSecret, totp }: { plainSecret: string; totp: string }) => {
			const now = timesAndTokens[0][0];
			const secret = base32Encode(Buffer.from(plainSecret));
			const value = generateTOTP(secret, { now });
			expect(value).toBe(totp);
		}
	);
});
