import { HttpStatusCode } from "@/helpers/HttpStatusCode";
import { InternalError } from "./InternalError";

export class NotEnoughRoomError extends InternalError {
	constructor(
		message: string = "There is not enough room to write your data. Delete some stuff first"
	) {
		super({ status: HttpStatusCode.INSUFFICIENT_STORAGE, message });
		this.name = "NotEnoughRoomError";
	}
}
