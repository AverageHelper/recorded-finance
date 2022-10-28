/*
 * Implementation of RFC 5054: https://www.rfc-editor.org/rfc/rfc5054
 *
 * Some example implementations, in no particular order:
 * - https://github.com/symeapp/srp-client
 * - https://github.com/secure-remote-password/stanford-srp
 * - https://github.com/YOU54F/cognito-srp
 * - https://github.com/1Password/srp
 * - https://github.com/ProtonMail/WebClients/blob/eb50e04ac7cecaff1a6feb9db072fd792d828efc/packages/shared/lib/srp.ts
 * - https://github.com/simbo1905/thinbus-srp-npm
 *
 * Test vectors:
 * - https://github.com/secure-remote-password/test-vectors
 */

import type { Encoding } from "node:crypto";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { requireEnv } from "../environment";
import BLAKE2s from "blake2s-js";
import blake2b from "blake2b";
import safeCompareStrings from "safe-compare";

/*
 * Notation (§2.1)
 */

// let N: bigint; // a safe prime "of the form N=2q+1, where q is also prime", MUST be "large enough to make calculating discrete logarithms computationally infeasible". See Appendix A for trusted sources from which to receive group parameters. Client may also use parameters configured locally "by a trusted administrator"
// let g: bigint; // generator, see §2.5.3 to create this and Appendix A for usable examples
// let s: bigint; // salt
// let B: bigint; // server's public value
// let b: bigint; // server's private value, "a random number that SHOULD be at least 256 bits in length"
// let A: bigint; // client's public value
// let a: bigint; // client's private value, "a random number that SHOULD be at least 256 bits in length"
// let I: string; // username
// let P: string; // password
// let v: bigint; // verifier
// let k: bigint; // SRP-6 multiplier

// string concatenation ("|" in spec, use template strings, the `+` operator, or `.concat`)
// exponentiation ("^" in spec, use `**`)
// "integer remainder"... modulo? ("%" in spec, use `%`)

export function bigintFromHex(hex: string): bigint {
	return BigInt(`0x${hex}`);
}

export function PAD(x: bigint, N: bigint): string {
	const nLength = N.toString(16).length;
	return x.toString(16).padStart(nLength, "0");
}

// username and password strings must be utf-8 unicode (§2.3)

// Be sure to do this over TLS, to handle the "certificate" parts of the SRP spec

// **
// ** Handshake Protocol (§2.2) **
// **

export function onClientHello(I: string, v: bigint, N: bigint, g: bigint): void {
	const s = undefined as unknown as bigint; // the user's salt from the username, or send a fake one if username is unknown
	const b = randomBits(256);
	const B = serverPublicValue(b, v, N, g, "sha1");
	sendServerHello(N, g, s, B);
}

function sendServerHello(N: bigint, g: bigint, s: bigint, B: bigint): void {
	// Server Hello
	// Server Key Exchange (N, g, s, B)
	// Server Hello Done
}

export function onClientKeyExchange(A: string): void {
	// [Change cipher spec]
	// Finished
	// ... give the user their JWT i guess
}

// **
// ** Verifier Creation (§2.4) **
// **

export function computeX(s: bigint, I: string, P: string, algorithm: HashAlgorithm): bigint {
	return HASH(algorithm, bigintFromHex(s.toString(16) + HASH(algorithm, `${I}:${P}`).toString(16)));
}

/**
 * @param s The user's salt
 * @param I The user's given username
 * @param P The user's password
 * @param N Group parameter N
 * @param g Group parameter g
 * @param algorithm The hashing algorithm to use
 */
export function verifier(
	s: bigint,
	I: string,
	P: string,
	N: bigint,
	g: bigint,
	algorithm: HashAlgorithm
): bigint {
	const x = computeX(s, I, P, algorithm);
	return modExp(g, x, N);
}

// **
// ** Client Hello (§2.5.1) **
// **

// Note on session resumption (§2.5.1.1):
// Client needs to include the "SRP extension" in the hello message; do full handshake in case server can't or won't resume the session (expiration?).
// If server doesn't want to resume the session, ignore the SRP extension "except for its inclusion in the finished message hashes".

// Note on unknown SRP info from client (§2.5.1.3):
// If there's no known verifier for the given username, respond with a "bad_record_mac" alert (see §2.9), to indicate that the password was wrong. (Matches legacy password-auth behavior.) Be sure to send a consistent salt (s) and group (N,g) values for the same username, to simulate the existence of an entry for the given username. For B, return a random value between 1 and N-1 inclusive, while simulating computation delays.
// - Generate a fake verifier using process.env.AUTH_SECRET for B

function fakeSaltForUnknownUsername(I: string): bigint {
	return HMAC_SHA1(requireEnv("AUTH_SECRET"), `salt${I}`);
}

// **
// ** Server Key Exchange (§2.5.3) **
// **

type ServerKeyMessage = ServerSRPParams;

// function getStoredVerifierForUsername(I: string): bigint {
// 	// read the database, get stored v
// }

/**
 * Do a constant time integer comparison. Always compare the complete numbers
 * against each other to get a constant time. This method does not short-cut
 * if the two number's length differs.
 */
function safeCompare(x: bigint, y: bigint): boolean {
	const a = x.toString(16);
	const b = y.toString(16);
	return safeCompareStrings(a, b);
}

export function computeK(N: bigint, g: bigint, algorithm: HashAlgorithm): bigint {
	return HASH(algorithm, bigintFromHex(N.toString(16) + PAD(g, N)));
}

/**
 * @param b The server's private value
 * @param v The user's stored verifier
 * @param N Group parameter N
 * @param g Group parameter g
 */
export function serverPublicValue(
	b: bigint,
	v: bigint,
	N: bigint,
	g: bigint,
	algorithm: HashAlgorithm
): bigint {
	const k = computeK(N, g, algorithm);
	const B = modAdd(k * v, modExp(g, b, N), N);
	if (safeCompare(B % N, 0n)) throw new IllegalParameterError(); // CRUCIAL for security
	return B;
}

// **
// ** Client Key Exchange (§2.5.4) **
// **

type ClientKeyMessage = ClientSRPPublic;

/**
 * @param a The client's private value
 * @param N Group parameter N
 * @param g Group parameter g
 */
export function clientPublicValue(a: bigint, N: bigint, g: bigint): bigint {
	const A = modExp(g, a, N);
	if (safeCompare(A % N, 0n)) throw new IllegalParameterError(); // CRUCIAL for security
	return A;
}

// **
// ** Premaster Secret (§2.6) **
// **

export class BadRecordMacError extends Error {
	readonly code: "bad_record_mac"; // the client should tell the user that the username/password are wrong

	constructor() {
		super("bad_record_mac");
		this.name = "BadRecordMacError";
		this.code = "bad_record_mac";
	}
}

export function computeU(A: bigint, B: bigint, N: bigint, algorithm: HashAlgorithm): bigint {
	return HASH(algorithm, bigintFromHex(PAD(A, N) + PAD(B, N)));
}

/**
 * @param a The client's private value
 * @param I The user's given username
 * @param P The user's given password
 * @param skm Key data from the server
 * @param algorithm The hashing algorithm to use
 */
export function clientPremasterSecret(
	a: bigint,
	I: string,
	P: string,
	skm: ServerKeyMessage,
	algorithm: HashAlgorithm
): bigint {
	const { N, g, s, B } = skm;
	const A = clientPublicValue(a, N, g);
	const u = computeU(A, B, N, algorithm);
	const k = computeK(N, g, algorithm);
	const x = computeX(s, I, P, algorithm);
	if (safeCompare(B % N, 0n)) throw new IllegalParameterError(); // CRUCIAL for security

	// S = (B - (k * g^x)) ^ (a + (u * x)) % N
	// See https://github.com/symeapp/srp-client/blob/5d3b61b19cf3a6319df05605abf89f83a411c29f/src/srp-client.js#L174
	const Bp = B + N * k; // Why do we transform B in this way? Seems non-standard
	const bx = modExp(g, x, N);
	const S = modExp(Bp - k * bx, u * x + a, N);
	return S;
}

/**
 * @param b The server's private value
 * @param N Group parameter N
 * @param g Group parameter g
 * @param v The user's password verifier
 * @param ckm The client's key message
 * @param algorithm The hashing algorithm to use
 */
export function serverPremasterSecret(
	b: bigint,
	N: bigint,
	g: bigint,
	v: bigint,
	ckm: ClientKeyMessage,
	algorithm: HashAlgorithm
): bigint {
	const { A } = ckm;
	const B = serverPublicValue(b, v, N, g, algorithm);
	const u = HASH(algorithm, bigintFromHex(PAD(A, N) + PAD(B, N)));
	if (safeCompare(A % N, 0n)) throw new IllegalParameterError(); // CRUCIAL for security

	// S = (A * v^u) ^ b % N
	const S = modExp(A * modExp(v, u, N), b, N);
	return S;
}

// **
// ** Server Key Exchange (§2.8.2) **
// **

// Auth should accept a KeyExchangeAlgorithm value. If that is "srp", use this file's methods should be used for verifying the password. (We can use the same endpoint! Only need client to inform server there whether we're using SRP, defaulting to legacy password auth)

interface ServerSRPParams {
	readonly N: bigint;
	readonly g: bigint;
	readonly s: bigint;
	readonly B: bigint;
}

// **
// ** Client Key Exchange (§2.8.3) **
// **

interface ClientSRPPublic {
	readonly A: bigint;
}

// **
// ** Error Alerts (§2.9) **
// **

/**
 * Sent by a client that receives unknown or untrusted (N, g) values.
 */
export class InsufficientSecurityError extends Error {
	readonly code: "insufficient_security";
	readonly num: 71;

	constructor() {
		super("insufficient_security");
		this.name = "InsufficientSecurityError";
		this.code = "insufficient_security";
		this.num = 71;
	}
}

/**
 * Sent by a client or server that receives a key exchange message with A % N = 0 or B % N = 0.
 */
class IllegalParameterError extends Error {
	readonly code: "illegal_parameter";
	readonly num: 47;

	constructor() {
		super("bad_record_mac");
		this.name = "IllegalParameterError";
		this.code = "illegal_parameter";
		this.num = 47;
	}
}

// **
// ** Important consideratons (§3.3) **
// **

// The threat model of SRP does not protect user passwords from dictionary attacks, even if the password file is stolen.

// **
// ** On the use of SHA-1 (§3.4) **
// **

// Collisions don't compromise our use of this cipher.
// Clients should send the cipher suite in the Client Hello message, because we'll need a way to migrate in case a viable attack on SHA-1 is discovered.

// **
// ** Operations not defined in the spec **
// **

const hashAlgorithms = [
	// Common (probably) on OpenSSL
	"sha1",
	"sha256",
	"sha384",
	"sha512",

	// Not tested
	// "sha224",
	// "gost-mac",
	// "md4",
	// "md5",
	// "md_gost94",
	// "ripemd160",
	// "streebog256",
	// "streebog512",
	// "whirlpool",

	// Handled specially
	"blake2s-256",
	"blake2b-224",
	// "blake2b-256", // broken, according to our test vectors
	"blake2b-384",
	"blake2b-512",
] as const;

type HashAlgorithm = typeof hashAlgorithms[number];

export function assertHashAlgorithm(tbd: string): asserts tbd is HashAlgorithm {
	if (!hashAlgorithms.includes(tbd as HashAlgorithm))
		throw new TypeError(`Value '${tbd}' does not match any of ${hashAlgorithms.join(", ")}`);
}

/**
 * Computes and returns a hash of the given data using the given algorithm.
 *
 * @param algorithm The hashing algorithm to use to generate the hash
 * @param textOrBytes The data to hash. String values are taken as UTF-8 encoded.
 * BigInt values are taken as hex-encoded bytes.
 */
export function HASH(algorithm: HashAlgorithm, textOrBytes: string | bigint): bigint {
	const data: string = typeof textOrBytes === "string" ? textOrBytes : textOrBytes.toString(16);
	const inputEncoding: Encoding = typeof textOrBytes === "string" ? "utf8" : "hex";

	if (algorithm === "blake2s-256") {
		const hash = new BLAKE2s();
		hash.update(Buffer.from(data, inputEncoding));
		return bigintFromHex(hash.hexDigest());
	}

	// if (algorithm === "blake2b-256") {
	// 	// FIXME: This doesn't match our test vectors:
	// 	const hash = blake2b(256 / 8);
	// 	hash.update(Buffer.from(data, inputEncoding));
	// 	return bigintFromHex(hash.digest("hex"));
	// }

	if (algorithm === "blake2b-224" || algorithm === "blake2b-384" || algorithm === "blake2b-512") {
		let outLength: number;
		switch (algorithm) {
			case "blake2b-224":
				outLength = 224 / 8;
				break;
			case "blake2b-384":
				outLength = 384 / 8;
				break;
			case "blake2b-512":
				outLength = 512 / 8;
				break;
		}
		const hash = blake2b(outLength);
		hash.update(Buffer.from(data, inputEncoding));
		return bigintFromHex(hash.digest("hex"));
	}

	const hash = createHash(algorithm);
	hash.update(data, inputEncoding);
	return bigintFromHex(hash.digest("hex"));
}

function HMAC_SHA1(key: string, data: string): bigint {
	const hmac = createHmac("sha1", key);
	hmac.update(data);
	return bigintFromHex(hmac.digest("hex"));
}

export function randomBits(bitCount: number): bigint {
	if (bitCount % 8 !== 0)
		throw new TypeError(`Given bit count '${bitCount}' must be a multiple of 8`);
	const numBytes = bitCount / 8;
	const bytes = randomBytes(numBytes);
	return bigintFromHex(bytes.toString("hex"));
}

function isEven(x: bigint): boolean {
	return safeCompare(x % 2n, 0n);
}

/**
 * Performs modular addition.
 *
 * @param x The integer to add
 * @param y The integer by which to add
 * @param N The largest value of any intermediate operation
 * @returns The modulated result of the exponentiation: x+y mod N
 */
function modAdd(x: bigint, y: bigint, N: bigint): bigint {
	return ((x % N) + (y % N)) % N;
}

/**
 * Performs modular exponentiation.
 *
 * @param x The integer to multiply
 * @param y The exponent
 * @param N The largest value of any intermediate operation
 * @returns The modulated result of the exponentiation: x^y mod N
 */
export function modExp(x: bigint, y: bigint, N: bigint): bigint {
	if (safeCompare(y, 0n)) {
		return 1n;
	}

	const z = modExp(x, y / 2n, N);
	if (isEven(y)) {
		return z ** 2n % N;
	}
	return (x * z ** 2n) % N;
}
