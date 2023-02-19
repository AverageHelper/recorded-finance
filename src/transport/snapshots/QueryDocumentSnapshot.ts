import type { DocumentReference } from "../db.js";
import { DocumentSnapshot } from "./DocumentSnapshot.js";

export class QueryDocumentSnapshot<T extends NonNullable<unknown>> extends DocumentSnapshot<T> {
	// non-null alternative constructor
	// eslint-disable-next-line @typescript-eslint/no-useless-constructor
	constructor(ref: DocumentReference<T>, data: T) {
		super(ref, data);
	}

	/**
	 * Retrieves all fields in the document as an `Object`.
	 *
	 * @override
	 * @returns An `Object` containing all fields in the document.
	 */
	data(): T {
		const data = super.data();
		if (data === undefined) {
			throw new TypeError(
				`Data at ref ${this.ref.parent.id}/${this.ref.id} is meant to exist but does not.`
			);
		}

		return data;
	}
}
