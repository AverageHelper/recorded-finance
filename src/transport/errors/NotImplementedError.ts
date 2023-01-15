import { HttpStatusCode } from "../../helpers/HttpStatusCode.js";
import { NetworkError } from "./NetworkError.js";

export class NotImplementedError extends NetworkError {
	constructor() {
		super(HttpStatusCode.NOT_IMPLEMENTED, {});
		this.name = "NotImplementedError";
	}
}
