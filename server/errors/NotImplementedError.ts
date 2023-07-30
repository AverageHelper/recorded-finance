import { HttpStatusCode } from "../helpers/HttpStatusCode";
import { InternalError } from "./InternalError";

export class NotImplementedError extends InternalError {
	constructor(nameOfFeature: string = "That feature") {
		super({
			status: HttpStatusCode.NOT_IMPLEMENTED,
			code: "not-implemented",
			// FIXME: This seems silly
			message: `${nameOfFeature} is not implemented yet`,
		});
		this.name = "NotImplementedError";
	}
}
