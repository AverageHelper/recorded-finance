import { HttpStatusCode } from "../helpers/HttpStatusCode";
import { InternalError } from "./InternalError";

export class NotEnoughUserSlotsError extends InternalError {
	constructor() {
		super({
			status: HttpStatusCode.LOCKED,
			code: "user-quota-exceeded",
			message: "We're full at the moment. Try again later!",
		});
		this.name = "NotEnoughUserSlotsError";
	}
}
