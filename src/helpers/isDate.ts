/**
 * Returns `true` if `tbd` is an instance of {@link Date}.
 */
export function isDate(tbd: unknown): tbd is Date {
	// Compare with https://github.com/lodash/lodash/blob/master/isDate.js
	return tbd instanceof Date;
}
