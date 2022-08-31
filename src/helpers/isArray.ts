import type { ValueIteratorTypeGuard } from "lodash";

/**
 * Returns `true` if `tbd` is an {@link Array}.
 */
export function isArray(tbd: unknown): tbd is Array<unknown> {
	return Array.isArray(tbd);
}

/**
 * Returns `true` if `tbd` is an {@link Array} of values that
 * each satisfy the given type guard.
 */
export function isArrayOf<T>(
	tbd: unknown,
	guard: ValueIteratorTypeGuard<unknown, T>
): tbd is Array<T> {
	return isArray(tbd) && tbd.every(guard);
}
