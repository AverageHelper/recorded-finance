import type { Request as ExpressRequest } from "express";
import type { Struct } from "superstruct";
import type { ValueIteratorTypeGuard } from "@/database/schemas";
import type { WebsocketRequestHandler } from "express-ws";
import type { WebSocket } from "ws";
import { assertSchema, isObject } from "@/database/schemas";
import { isWebSocketCode, WebSocketCode } from "./WebSocketCode";
import { logger } from "@/logger";
import { StructError } from "superstruct";
import { WebSocketError } from "@/errors/WebSocketError";

/** The type that a type guard is checking. */
type TypeFromGuard<G> = G extends ValueIteratorTypeGuard<unknown, infer T> ? T : never;

type WebSocketMessages = Record<string, ValueIteratorTypeGuard<unknown, unknown>>;

interface WebSocketUtils<T extends WebSocketMessages> {
	/** The request that started the connection. */
	req: ExpressRequest;

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
 * @param req The request that started the connection.
 * @param ws The {@link WebSocket} instance by which to send and receive messages.
 * @param interactions The types of interactions expected to be sent over the connection.
 *
 * @returns An object with utility functions to use to interact with the client.
 */
export function wsFactory<T extends WebSocketMessages>(
	req: ExpressRequest,
	ws: WebSocket,
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
			!isObject(tbd) || //
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

	// Send an occasional ping
	// If the client doesn't respond a few times consecutively, assume they aren't coming back
	let timesNotThere = 0;
	ws.on("open", () => {
		const pingInterval = setInterval(() => {
			if (timesNotThere > 5) {
				logger.info("Client didn't respond after 5 tries. Closing");
				close(ws, WebSocketCode.WENT_AWAY, "Client did not respond to pings, probably dead");
				clearInterval(pingInterval);
				return;
			}
			ws.ping();
			logger.debug("sent ping to client");
			timesNotThere += 1; // this goes away if the client responds
		}, 10_000); // 10 second interval

		ws.on("close", () => {
			clearInterval(pingInterval);
		});
	});

	ws.on("pong", () => {
		logger.debug("received pong from client");
		timesNotThere = 0;
	});

	ws.on("ping", data => {
		logger.debug("ping", data);
		ws.pong(data); // answer the ping with the data
	});

	// Application-layer communications
	return {
		req,

		onClose(cb): void {
			ws.on("close", (code, reason) => {
				if (isWebSocketCode(code)) {
					cb(code, reason.toString("utf-8"));
				} else {
					const msg = reason.toString("utf-8");
					if (msg) {
						cb(
							WebSocketCode.UNEXPECTED_CONDITION,
							`Client closed the connection with reason "${msg}" and unknown code ${code}`
						);
					} else {
						cb(
							WebSocketCode.UNEXPECTED_CONDITION,
							`Client closed the connection with unknown code ${code}`
						);
					}
				}
			});
		},

		onMessage(name, cb): void {
			ws.on("message", msg => {
				try {
					const message = JSON.parse((msg as Buffer).toString()) as unknown;
					if (!isWebSocketMessage(name, message))
						throw new WebSocketError(WebSocketCode.WRONG_MESSAGE_TYPE, "Improper message");

					cb(message.data);
				} catch (error) {
					if (error instanceof WebSocketError) {
						close(ws, error.code, error.reason);
					} else {
						logger.error("Unknown WebSocket message error:", error);
						close(ws, WebSocketCode.UNEXPECTED_CONDITION, "Internal error");
					}
				}
			});

			ws.on("error", error => {
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

export function ws<P, T extends WebSocketMessages>(
	interactions: T,
	params: Struct<P>,
	start: (context: WebSocketUtils<T>, params: P) => void | Promise<void>
): WebsocketRequestHandler {
	return function webSocket(ws, req, next): void {
		const context = wsFactory(req, ws, interactions);

		// Ensure valid input
		try {
			assertSchema(req.params, params);
		} catch (error) {
			if (error instanceof StructError) {
				return context.close(WebSocketCode.VIOLATED_CONTRACT, error.message);
			}
			logger.error("Unknown error trying to validate WebSocket inputs:", error);
			return context.close(WebSocketCode.UNEXPECTED_CONDITION, "Internal error");
		}

		// eslint-disable-next-line promise/prefer-await-to-then, promise/no-callback-in-promise
		Promise.resolve(start(context, req.params)).then(next).catch(next);
	};
}
