import type { ErrorCode } from "./InternalError.js";
import { InternalError } from "./InternalError.js";

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
