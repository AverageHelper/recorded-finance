import { t } from "../../i18n";
import { UnreachableCaseError } from "./UnreachableCaseError.js";

export type AccountableErrorCode =
	| "auth/account-already-exists"
	| "auth/internal-error"
	| "auth/invalid-argument"
	| "auth/invalid-credential"
	| "auth/quota-exceeded"
	| "auth/unauthenticated"
	| "database/deadline-exceeded"
	| "database/failed-precondition"
	| "database/internal-error"
	| "database/invalid-argument"
	| "database/unauthenticated"
	| "storage/internal-error"
	| "storage/invalid-argument"
	| "storage/invalid-checksum"
	| "storage/quota-exceeded"
	| "storage/retry-limit-exceeded"
	| "storage/server-file-wrong-size"
	| "storage/unauthenticated";

function messageFromCode(code: AccountableErrorCode): string {
	switch (code) {
		case "auth/account-already-exists":
			return t("error.auth.account-already-exists");
		case "auth/internal-error":
			return t("error.auth.internal");
		case "auth/invalid-argument":
			return t("error.auth.invalid-argument");
		case "auth/invalid-credential":
			return t("error.auth.invalid-credential");
		case "auth/quota-exceeded":
		case "database/deadline-exceeded":
			return t("error.server.throttled");
		case "database/failed-precondition":
			return t("error.db.failed-precondition");
		case "database/internal-error":
			return t("error.db.internal");
		case "database/invalid-argument":
			return t("error.db.invalid-argument");
		case "storage/internal-error":
			return t("error.storage.internal");
		case "storage/invalid-argument":
			return t("error.storage.invalid-argument");
		case "storage/invalid-checksum":
			return t("error.storage.invalid-checksum");
		case "storage/quota-exceeded":
		case "storage/retry-limit-exceeded":
			return t("error.server.throttled");
		case "storage/server-file-wrong-size":
			return t("error.storage.server-file-wrong-size");
		case "auth/unauthenticated":
		case "database/unauthenticated":
		case "storage/unauthenticated":
			return t("error.auth.unauthenticated");
		default:
			throw new UnreachableCaseError(code);
	}
}

export class AccountableError extends Error {
	readonly code: AccountableErrorCode;
	customData?: Record<string, unknown> | undefined;
	readonly name = "AccountableError";

	constructor(code: AccountableErrorCode, customData?: Record<string, unknown> | undefined) {
		super(messageFromCode(code));
		this.code = code;
		this.customData = customData;
	}

	toString(): string {
		return JSON.stringify({
			name: this.name,
			code: this.code,
			message: this.message,
		});
	}
}
