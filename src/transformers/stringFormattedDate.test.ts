import { describe, expect, test } from "vitest";
import { stringFormattedDate } from "./stringFormattedDate.js";

describe("Date stringifier", () => {
	// TODO: Check that stringFormattedDate always returns a correctly-formatted string from a Date
	test.each`
		from                            | to
		${new Date(2028, 11, 15, 0, 0)} | ${"2028-12-15T00:00"}
		${new Date(2022, 7, 15, 12, 0)} | ${"2022-08-15T12:00"}
		${new Date(2022, 7, 15, 0, 0)}  | ${"2022-08-15T00:00"}
		${new Date(2018, 0, 2, 0, 0)}   | ${"2018-01-02T00:00"}
		${new Date(2018, 0, 1, 24, 0)}  | ${"2018-01-02T00:00"}
		${new Date(2018, 0, 2, -1, 0)}  | ${"2018-01-01T23:00"}
		${new Date(2018, 0, 1, 23, 0)}  | ${"2018-01-01T23:00"}
		${new Date(2018, 0, 1, 0, 0)}   | ${"2018-01-01T00:00"}
	`(
		"formats a date in the way expected by datetime-local: $to",
		({ from, to }: { from: Date; to: string }) => {
			expect(stringFormattedDate(from)).toBe(to);
		}
	);

	test("returns undefined from null input", () => {
		expect(stringFormattedDate(null)).toBeUndefined();
	});
});
