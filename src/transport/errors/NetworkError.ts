import type { HttpStatusCode } from "helpers/HttpStatusCode.js";
import type { RawServerResponse } from "../schemas";
import { t } from "../../i18n";

const errorCodes = [
	"account-conflict",
	"bad-gateway",
	"bad-method",
	"expired-token",
	"missing-token",
	"missing-mfa-credentials",
	"not-found",
	"not-implemented",
	"not-owner",
	"too-many-requests",
	"totp-conflict",
	"totp-secret-missing",
	"wrong-credentials",
	"wrong-mfa-credentials",
	"unknown",
] as const;

type ErrorCode = (typeof errorCodes)[number];

function isKnownErrorCode(tbd: unknown): tbd is ErrorCode {
	return errorCodes.includes(tbd as ErrorCode);
}

function messageFromCode(code: ErrorCode): string {
	// TODO: Maybe move this call closer to the UI
	return t(`error.network.${code}`);
}

/** An error provided to us by the server. */
export class NetworkError extends Error {
	readonly status: Readonly<HttpStatusCode>;
	readonly code: Readonly<ErrorCode>;

	constructor(status: HttpStatusCode, response: RawServerResponse | null) {
		const code = response?.code;
		const message = isKnownErrorCode(code)
			? messageFromCode(code)
			: `[${code ?? "undefined"}] ${response?.message ?? "undefined"}`;
		super(message);
		this.name = "NetworkError";
		this.status = status;
		this.code = isKnownErrorCode(code) ? code : "unknown";
	}
}
