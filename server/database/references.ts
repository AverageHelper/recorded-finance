import type { CollectionID } from "./schemas.js";
import { isCollectionId } from "./schemas.js";

export class CollectionReference<ID extends CollectionID = CollectionID> {
	public readonly uid: Readonly<string>;
	public readonly id: ID;

	constructor(uid: string, id: ID) {
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

export class DocumentReference<ID extends CollectionID = CollectionID> {
	public readonly id: Readonly<string>;
	public readonly parent: Readonly<CollectionReference<ID>>;

	constructor(parent: CollectionReference<ID>, id: string) {
		this.parent = parent;
		this.id = id;
	}

	get uid(): string {
		return this.parent.uid.slice();
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
