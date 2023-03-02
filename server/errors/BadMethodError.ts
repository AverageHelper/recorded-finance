import { HttpStatusCode } from "../helpers/HttpStatusCode";
import { InternalError } from "./InternalError";

export class BadMethodError extends InternalError {
	constructor() {
		super({
			status: HttpStatusCode.METHOD_NOT_ALLOWED,
			code: "bad-method",
			message: "That method is not allowed here. What are you trying to do?",
			harmless: true,
		});
		this.name = "BadMethodError";
	}
}
