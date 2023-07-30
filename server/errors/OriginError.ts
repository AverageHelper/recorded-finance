import { HttpStatusCode } from "../helpers/HttpStatusCode";
import { InternalError } from "./InternalError";

export class OriginError extends InternalError {
	constructor() {
		super({
			status: HttpStatusCode.BAD_GATEWAY,
			code: "bad-gateway",
			message: "The CORS policy for this site does not allow access from the specified Origin.",
			harmless: true,
		});
		this.name = "OriginError";
	}
}
