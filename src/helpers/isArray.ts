/**
 * Returns `true` if `tbd` is an {@link Array}.
 */
export function isArray(tbd: unknown): tbd is Array<unknown> {
	return Array.isArray(tbd);
}
