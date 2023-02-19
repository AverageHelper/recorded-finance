import type { DocumentData } from "../schemas.js";
import type { DocumentReference } from "../db.js";
import type { QueryDocumentSnapshot } from "./QueryDocumentSnapshot.js";

export class DocumentSnapshot<T extends NonNullable<unknown> = DocumentData> {
	#data: T | null;

	/**
	 * The `DocumentReference` for the document included in the `DocumentSnapshot`.
	 */
	public readonly ref: DocumentReference<T>;

	constructor(ref: DocumentReference<T>, data: T | null) {
		this.#data = data;
		this.ref = ref;
	}

	/**
	 * Property of the `DocumentSnapshot` that provides the document's ID.
	 */
	get id(): string {
		return this.ref.id;
	}

	/**
	 * Property of the `DocumentSnapshot` that signals whether or not the data
	 * exists. True if the document exists.
	 */
	exists(): this is QueryDocumentSnapshot<T> {
		return this.#data !== null;
	}

	/**
	 * Retrieves all fields in the document as an `Object`. Returns `undefined` if
	 * the document doesn't exist.
	 *
	 * @returns An `Object` containing all fields in the document or `undefined` if
	 * the document doesn't exist.
	 */
	data(): T | undefined {
		return this.#data ?? undefined;
	}
}
