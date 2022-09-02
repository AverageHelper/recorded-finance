/**
 * Returns `true` if `tbd` is a `string` value.
 */
export function isString(tbd: unknown): tbd is string {
	// Compare with https://github.com/lodash/lodash/blob/master/isString.js
	return typeof tbd === "string";
}
