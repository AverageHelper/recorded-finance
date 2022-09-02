import type { WebSocketCode } from "../websockets/WebSocketCode.js";

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
