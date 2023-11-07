import { describe, expect, test } from "vitest";
import { simplifiedByteCount } from "./simplifiedByteCount";

describe("Human-readable byte count formatter", () => {
	// ** Positive numbers
	test.each`
		num                      | result
		${0}                     | ${"0 byte"}
		${1}                     | ${"1 byte"}
		${100}                   | ${"100 byte"}
		${1000}                  | ${"1 kB"}
		${10_000}                | ${"10 kB"}
		${10_500}                | ${"10.5 kB"}
		${1_000_000}             | ${"1 MB"}
		${1_000_000_000}         | ${"1 GB"}
		${22_550_000_000}        | ${"22.55 GB"}
		${1_000_000_000_000}     | ${"1 TB"}
		${1_000_000_000_000_000} | ${"1 PB"}
		${1_000_000_000_001_000} | ${"1 PB"}
		${9_007_199_254_740_991} | ${"9.01 PB"}
	`("formats $num to '$result'", ({ num, result }: { num: number; result: string }) => {
		expect(simplifiedByteCount("en-US", num)).toBe(result);
	});

	// ** Negative numbers
	test.each`
		num                       | result
		${-0}                     | ${"-0 byte"}
		${-100}                   | ${"-100 byte"}
		${-1000}                  | ${"-1 kB"}
		${-10_000}                | ${"-10 kB"}
		${-10_500}                | ${"-10.5 kB"}
		${-1_000_000}             | ${"-1 MB"}
		${-1_000_000_000}         | ${"-1 GB"}
		${-22_550_000_000}        | ${"-22.55 GB"}
		${-1_000_000_000_000}     | ${"-1 TB"}
		${-1_000_000_000_000_000} | ${"-1 PB"}
		${-1_000_000_000_001_000} | ${"-1 PB"}
		${-9_007_199_254_740_991} | ${"-9.01 PB"}
	`("formats $num to '$result'", ({ num, result }: { num: number; result: string }) => {
		expect(simplifiedByteCount("en-US", num)).toBe(result);
	});
});
