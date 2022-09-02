/**
 * Returns `true` if `tbd` is a `boolean` value.
 */
export function isBoolean(tbd: unknown): tbd is boolean {
	// Compare with https://github.com/lodash/lodash/blob/master/isBoolean.js
	return tbd === true || tbd === false;
}
