import { InternalError } from "./InternalError";

export type UnauthorizedErrorCode =
	| "expired-token"
	| "missing-mfa-credentials"
	| "missing-token"
	| "not-owner"
	| "wrong-credentials"
	| "wrong-mfa-credentials";

function defaultMessageFromCode(code: UnauthorizedErrorCode): string {
	// Clients should do their own work to i18nalize the error code.
	// This switch is here for lazy clients that are okay with the default English message.
	switch (code) {
		case "expired-token":
			return "You must sign in again in order to proceed";
		case "missing-mfa-credentials":
			return "You must provide a TOTP code";
		case "missing-token":
			return "Unauthorized";
		case "not-owner":
			return "Unauthorized";
		case "wrong-credentials":
			return "Incorrect account ID or passphrase";
		case "wrong-mfa-credentials":
			return "That code is invalid";
	}
}

export class UnauthorizedError extends InternalError {
	constructor(code: UnauthorizedErrorCode) {
		const message = defaultMessageFromCode(code);
		super({ status: 403, code, message, harmless: true });
		this.name = "UnauthorizedError";
	}
}
