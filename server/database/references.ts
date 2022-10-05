import type { CollectionID } from "./schemas";
import { isCollectionId } from "./schemas";

export class CollectionReference {
	public readonly uid: string;
	public readonly id: CollectionID;

	constructor(uid: string, id: CollectionID) {
		if (!isCollectionId(id)) throw new TypeError(`${JSON.stringify(id)} is not a collection ID`);
		this.uid = uid;
		this.id = id;
	}

	get path(): string {
		return `users/${this.uid}/${this.id}`;
	}

	toString(): string {
		return JSON.stringify({
			id: this.id,
		});
	}
}

export class DocumentReference {
	public readonly id: string;
	public readonly parent: CollectionReference;

	constructor(parent: CollectionReference, id: string) {
		this.parent = parent;
		this.id = id;
	}

	get uid(): string {
		return this.parent.uid;
	}

	get path(): string {
		return this.parent.path.concat("/", this.id);
	}

	toString(): string {
		return JSON.stringify({
			id: this.id,
			parent: this.parent.id,
		});
	}
}
