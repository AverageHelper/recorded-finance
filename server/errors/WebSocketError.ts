import type { WebSocketCode } from "../networking/WebSocketCode.js";

export class WebSocketError extends Error {
	readonly code: WebSocketCode;

	constructor(code: WebSocketCode, reason: string) {
		super(reason);
		this.name = "WebSocketError";
		this.code = code;
	}

	get reason(): string {
		return this.message;
	}
}
