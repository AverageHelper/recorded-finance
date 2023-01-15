import type { ValueIteratorTypeGuard } from "lodash";
import { isRecord } from "../schemas.js";
import { isWebSocketCode, WebSocketCode } from "./WebSocketCode.js";
import { logger } from "../../logger.js";
import { t } from "../../i18n.js";
import { UnexpectedResponseError } from "../errors/UnexpectedResponseError.js";

class WebSocketError extends Error {
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

/** The type that a type guard is checking. */
type TypeFromGuard<G> = G extends ValueIteratorTypeGuard<unknown, infer T> ? T : never;

type WebSocketMessages = Record<string, ValueIteratorTypeGuard<unknown, unknown>>;

interface WebSocketUtils<T extends WebSocketMessages> {
	/**
	 * Registers a function to be called when the connection closes.
	 * Use this as an opportunity to clean up session-dependent resources.
	 */
	onClose: (cb: (code: WebSocketCode, reason: string) => void) => void;

	/**
	 * Registers a function to be called when the client sends
	 * a message via the websocket.
	 */
	onMessage: <K extends keyof T, G extends T[K]>(
		name: K,
		cb: (data: TypeFromGuard<G>) => void
	) => void;

	/** Sends a message to the client via the websocket. */
	send: <K extends keyof T, G extends T[K]>(name: K, data: TypeFromGuard<G>) => void;

	/** Closes the websocket. */
	close: (code: WebSocketCode, reason: string) => void;
}

/**
 * Constructs a type-safe websocket interface.
 *
 * @param url The URL of the server with which the WebSocket communication should take place.
 * @param interactions The types of interactions expected to be sent over the connection.
 *
 * @returns An object with utility functions to use to interact with the client.
 */
export function wsFactory<T extends WebSocketMessages>(
	url: URL,
	interactions: T
): WebSocketUtils<T> {
	interface _WebSocketMessage<M extends keyof T> {
		name: M;
		data: TypeFromGuard<T[M]>;
	}

	function isWebSocketMessage<M extends keyof T>(
		name: M,
		tbd: unknown
	): tbd is _WebSocketMessage<M> {
		if (
			!isRecord(tbd) || //
			!("name" in tbd) ||
			!("data" in tbd) ||
			tbd["name"] !== name
		)
			return false;

		// check name
		const guard = interactions[name];
		if (!guard) return false;

		// check data
		return guard(tbd["data"]);
	}

	function close(ws: WebSocket, code: WebSocketCode, reason: string): void {
		ws.close(code, reason);
	}

	function send<M extends keyof T>(ws: WebSocket, message: _WebSocketMessage<M>): void {
		ws.send(JSON.stringify(message));
	}

	// Application-layer communications
	const WS_ORIGIN = url.origin;
	const ws = new WebSocket(url);
	return {
		onClose(cb): void {
			ws.addEventListener("close", ({ code, reason }) => {
				if (isWebSocketCode(code)) {
					cb(code, reason);
				} else {
					if (reason) {
						cb(
							WebSocketCode.UNEXPECTED_CONDITION,
							`Server closed the connection with reason "${reason}" and unknown code ${code}`
						);
					} else {
						cb(
							WebSocketCode.UNEXPECTED_CONDITION,
							`Server closed the connection with unknown code ${code}`
						);
					}
				}
			});
		},

		onMessage(name, cb): void {
			ws.addEventListener("message", event => {
				if (event.origin !== WS_ORIGIN) {
					// Check that this message is from the expected source. See: https://cwe.mitre.org/data/definitions/20.html
					logger.warn(
						`Received WebSocket message from unknown origin '${event.origin}'. (Expected origin is '${WS_ORIGIN}')`
					);
					return;
				}

				let message: unknown;
				try {
					message = JSON.parse((event.data as { toString: () => string }).toString()) as unknown;
				} catch (error) {
					throw new UnexpectedResponseError(
						t("error.ws.not-json", { values: { message: JSON.stringify(error) } })
					);
				}

				try {
					if (!isWebSocketMessage(name, message))
						throw new WebSocketError(WebSocketCode.WRONG_MESSAGE_TYPE, "Improper message");

					cb(message.data);
				} catch (error) {
					if (error instanceof WebSocketError) {
						close(ws, error.code, error.reason);
					} else {
						logger.error(error);
						close(ws, WebSocketCode.UNEXPECTED_CONDITION, "Internal error");
					}
				}
			});

			ws.addEventListener("error", error => {
				logger.error("Websocket error:", error);
			});
		},

		send(name, data): void {
			send(ws, { name, data });
		},

		close(code, reason): void {
			close(ws, code, reason);
		},
	};
}
