/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * isObject({})
 * // => true
 *
 * isObject([1, 2, 3])
 * // => true
 *
 * isObject(Function)
 * // => true
 *
 * isObject(null)
 * // => false
 */
export function isObject(tbd: unknown): tbd is object {
	// Modified from https://github.com/lodash/lodash/blob/2da024c3b4f9947a48517639de7560457cd4ec6c/isObject.js
	const type = typeof tbd;
	return tbd !== undefined && tbd !== null && (type === "object" || type === "function");
}
