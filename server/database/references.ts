import type { CollectionID, UID, User } from "./schemas";
import { isCollectionId } from "./schemas";

export class CollectionReference {
	public readonly user: Readonly<User>;
	public readonly id: CollectionID;

	constructor(user: User, id: CollectionID) {
		if (!isCollectionId(id)) throw new TypeError(`${JSON.stringify(id)} is not a collection ID`);
		this.user = user;
		this.id = id;
	}

	get uid(): UID {
		return this.user.uid;
	}

	get path(): string {
		return `users/${this.uid}/${this.id}`;
	}

	toString(): string {
		return JSON.stringify({
			id: this.id,
			uid: this.uid,
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

	get user(): User {
		return this.parent.user;
	}

	get uid(): UID {
		return this.parent.uid;
	}

	get path(): string {
		return this.parent.path.concat("/", this.id);
	}

	toString(): string {
		return JSON.stringify({
			id: this.id,
			parent: this.parent.id,
			uid: this.uid,
		});
	}
}
