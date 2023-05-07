import type { ErrorCode } from "./InternalError";
import { HttpStatusCode } from "@/helpers/HttpStatusCode";
import { InternalError } from "./InternalError";

export class ConflictError extends InternalError {
	constructor(code: ErrorCode, message: string) {
		super({
			status: HttpStatusCode.CONFLICT,
			code,
			message,
			harmless: false,
		});
		this.name = "ConflictError";
	}
}
