/**
 * Concatenates the given strings. If either argument is `undefined`, the
 * result is `undefined`.
 *
 * @example
 * ```ts
 * const val = concatStrings("node_", process.env.NODE_ENV);
 * // If `NODE_ENV=production` on the process environment, then `val` is `'node_production'`.
 * // If `NODE_ENV` is not found on the environment, then `val` is `undefined`.
 * ```
 *
 * @param first The first string.
 * @param second The second string.
 * @returns The concatenated strings, or `undefined`.
 */
export function concatStrings<T extends string, U extends string>(first: T, second: U): `${T}${U}`;

export function concatStrings<U extends string>(first: undefined, second: U): undefined;

export function concatStrings<T extends string>(first: T, second: undefined): undefined;

export function concatStrings<T extends string, U extends string>(
	first: T | undefined,
	second: U | undefined
): `${T}${U}` | undefined;

export function concatStrings<T extends string, U extends string>(
	first: T | undefined,
	second: U | undefined
): `${T}${U}` | undefined {
	if (first === undefined || second === undefined) return undefined;
	return `${first}${second}`;
}
