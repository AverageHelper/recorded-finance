import { HttpStatusCode } from "@/helpers/HttpStatusCode";
import { InternalError } from "./InternalError";

export class NotFoundError extends InternalError {
	constructor() {
		super({
			status: HttpStatusCode.NOT_FOUND,
			code: "not-found",
			message: "No data found",
			harmless: true,
		});
		this.name = "NotFoundError";
	}
}
