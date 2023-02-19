import type { Query } from "../db.js";
import type { QueryDocumentSnapshot } from "./QueryDocumentSnapshot.js";
import { logger } from "../../logger.js";

type DocumentChangeType = "added" | "removed" | "modified";

interface DocumentChange<T extends NonNullable<unknown>> {
	/** The type of change ('added', 'modified', or 'removed'). */
	readonly type: DocumentChangeType;

	/** The document affected by this change. */
	readonly doc: QueryDocumentSnapshot<T>;

	/**
	 * The index of the changed document in the result set immediately prior to
	 * this `DocumentChange` (i.e. supposing that all prior `DocumentChange` objects
	 * have been applied). Is `-1` for 'added' events.
	 */
	readonly oldIndex: number;

	/**
	 * The index of the changed document in the result set immediately after
	 * this `DocumentChange` (i.e. supposing that all prior `DocumentChange`
	 * objects and the current `DocumentChange` object have been applied).
	 * Is -1 for 'removed' events.
	 */
	readonly newIndex: number;
}

export class QuerySnapshot<T extends NonNullable<unknown>> {
	#previousSnapshot: QuerySnapshot<T> | null;

	/** An array of all the documents in the `QuerySnapshot`. */
	public readonly docs: ReadonlyArray<QueryDocumentSnapshot<T>>;

	/**
	 * The query on which you called `get` or `onSnapshot` in order to get this
	 * `QuerySnapshot`.
	 */
	public readonly query: Query<T>;

	/**
	 * @param prev The previous query snapshot, used for generating the result of the `docChanges` method.
	 * @param docs The documents in the snapshot.
	 */
	constructor(prev: QuerySnapshot<T>, docs: ReadonlyArray<QueryDocumentSnapshot<T>>);

	/**
	 * @param query The query used to generate the snapshot.
	 * @param docs The documents in the snapshot.
	 */
	// eslint-disable-next-line @typescript-eslint/unified-signatures
	constructor(query: Query<T>, docs: ReadonlyArray<QueryDocumentSnapshot<T>>);

	/**
	 * @param queryOrPrev The query used to generate the snapshot, or
	 * the previous snapshot in the chain.
	 * @param docs The documents in the snapshot.
	 */
	constructor(
		// eslint-disable-next-line @typescript-eslint/unified-signatures
		queryOrPrev: Query<T> | QuerySnapshot<T>,
		docs: ReadonlyArray<QueryDocumentSnapshot<T>>
	);

	constructor(
		queryOrPrev: Query<T> | QuerySnapshot<T>,
		docs: ReadonlyArray<QueryDocumentSnapshot<T>>
	) {
		if ("type" in queryOrPrev) {
			// Query
			this.#previousSnapshot = null;
			this.query = queryOrPrev;
		} else {
			// QuerySnapshot
			this.#previousSnapshot = queryOrPrev;
			this.query = queryOrPrev.query;
		}
		this.docs = docs;
	}

	/** The number of documents in the `QuerySnapshot`. */
	get size(): number {
		return this.docs.length;
	}

	/** True if there are no documents in the `QuerySnapshot`. */
	get empty(): boolean {
		return this.size === 0;
	}

	/**
	 * Enumerates all of the documents in the `QuerySnapshot`.
	 *
	 * @param callback - A callback to be called with a `QueryDocumentSnapshot` for
	 * each document in the snapshot.
	 * @param thisArg - The `this` binding for the callback.
	 */
	forEach(callback: (result: QueryDocumentSnapshot<T>) => void, thisArg?: unknown): void {
		this.docs.forEach(callback, thisArg);
	}

	/**
	 * Returns an array of the documents changes since the last snapshot. If this
	 * is the first snapshot, all documents will be in the list as 'added'
	 * changes.
	 */
	docChanges(): Array<DocumentChange<T>> {
		const prev = this.#previousSnapshot;

		if (!prev) {
			// add all as "added" changes
			return this.docs.map((doc, newIndex) => ({
				type: "added",
				doc,
				oldIndex: -1,
				newIndex,
			}));
		}

		// diff the snapshots from `prev`
		const result: Array<DocumentChange<T>> = [];
		for (let newIndex = 0; newIndex < this.docs.length; newIndex++) {
			const doc = this.docs[newIndex] as QueryDocumentSnapshot<T>; // ASSUMPTION: This is a proper `for` loop.
			const oldIndex = prev.docs.findIndex(d => d.id === doc.id);

			if (oldIndex === -1) {
				result.push({ type: "added", doc, oldIndex, newIndex });
			} else {
				const modify: DocumentChange<T> = { type: "modified", doc, oldIndex, newIndex };

				// Only include if the index or data are changed
				const oldDoc = prev.docs[oldIndex] as QueryDocumentSnapshot<T>; // ASSUMPTION: This is a valid index

				const oldData = JSON.stringify(oldDoc.data());
				const newData = JSON.stringify(modify.doc.data());
				if (oldData !== newData) logger.info("oldData v newData", oldData, newData);
				if (modify.newIndex !== modify.oldIndex || oldData !== newData) {
					result.push(modify);
				}
			}
		}

		// add documents that were removed since `prev`
		const removedDocs: Array<DocumentChange<T>> = prev.docs
			.map<DocumentChange<T>>((doc, oldIndex) => {
				const newIndex = this.docs.findIndex(d => d.id === doc.id);
				if (newIndex === -1) {
					return { type: "removed", doc, oldIndex, newIndex };
				}
				return { type: "modified", doc, oldIndex, newIndex };
			})
			.filter(change => change.type === "removed");
		result.push(...removedDocs);

		return result;
	}
}
