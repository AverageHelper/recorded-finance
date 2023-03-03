import type { Readable, Writable } from "svelte/store";
import { derived, writable } from "svelte/store";

/**
 * Constructs a {@link Writable} store and a derived {@link Readable} store.
 * Updating the writable store automatically updates the value of the derived store.
 * Export the readable store for a locally-writeable read-only observable value.
 *
 * @returns A tuple containing the readable and writeable stores, respectively.
 */
export function moduleWritable<T>(initialValue: T): [Readable<T>, Writable<T>] {
	const w = writable<T>(initialValue); // storage
	const r = derived(w, $currentValue => $currentValue); // read-only view of the storage
	return [r, w];
}
