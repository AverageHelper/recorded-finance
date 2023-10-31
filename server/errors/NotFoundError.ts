import { HttpStatusCode } from "../helpers/HttpStatusCode";
import { InternalError } from "./InternalError";

export class NotFoundError extends InternalError {
	constructor(message: string = "No data found") {
		super({
			status: HttpStatusCode.NOT_FOUND,
			code: "not-found",
			message,
			harmless: true,
		});
		this.name = "NotFoundError";
	}
}
