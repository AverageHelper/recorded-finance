/**
 * Returns `true` if `tbd` is a `number` value.
 */
export function isNumber(tbd: unknown): tbd is number {
	// Compare with https://github.com/lodash/lodash/blob/master/isNumber.js
	return typeof tbd === "number";
}
