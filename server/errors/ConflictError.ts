import type { ErrorCode } from "./InternalError";
import { InternalError } from "./InternalError";

export class ConflictError extends InternalError {
	constructor(code: ErrorCode, message: string) {
		super({
			status: 409,
			code,
			message,
			harmless: false,
		});
		this.name = "ConflictError";
	}
}
