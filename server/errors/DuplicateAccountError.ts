import { ConflictError } from "./ConflictError";

export class DuplicateAccountError extends ConflictError {
	constructor() {
		super("account-conflict", "An account with that ID already exists");
		this.name = "DuplicateAccountError";
	}
}
