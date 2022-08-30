import type { Request } from "express";
import type { ValueIteratorTypeGuard } from "../database/index.js";
import type { WebsocketRequestHandler } from "express-ws";
import type { WebSocket } from "ws";
import Joi from "joi";
import { assertSchema, isObject } from "../database/schemas.js";
import { WebSocketCode } from "./WebSocketCode.js";
import { WebSocketError } from "../errors/WebSocketError.js";

/** The type that a type guard is checking. */
type TypeFromGuard<G> = G extends ValueIteratorTypeGuard<unknown, infer T> ? T : never;

type WebSocketMessages = Record<string, ValueIteratorTypeGuard<unknown, unknown>>;

interface WebSocketUtils<T extends WebSocketMessages> {
	/**
	 * Registers a function to be called when the connection closes.
	 * Use this as an opportunity to clean up session-dependent resources.
	 */
	onClose: (cb: () => void) => void;

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
 * @param ws The {@link WebSocket} instance by which to send and receive messages.
 * @param interactions The types of interactions expected to be sent over the connection.
 *
 * @returns An object with utility functions to use to interact with the client.
 */
export function wsFactory<T extends WebSocketMessages>(
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
				process.stdout.write("Client didn't respond after 5 tries. Closing\n");
				close(ws, WebSocketCode.WENT_AWAY, "Client did not respond to pings, probably dead");
				clearInterval(pingInterval);
				return;
			}
			ws.ping();
			console.debug("sent ping to client");
			timesNotThere += 1; // this goes away if the client responds
		}, 10000); // 10 second interval

		ws.on("close", () => {
			clearInterval(pingInterval);
		});
	});

	ws.on("pong", () => {
		console.debug("received pong from client");
		timesNotThere = 0;
	});

	ws.on("ping", data => {
		console.debug("ping", data);
		ws.pong(data); // answer the ping with the data
	});

	// Application-layer communications
	return {
		onClose(cb): void {
			ws.on("close", () => {
				cb();
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
						console.error(error);
						close(ws, WebSocketCode.UNEXPECTED_CONDITION, "Internal error");
					}
				}
			});

			ws.on("error", error => {
				console.error("Websocket error:", error);
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

export function ws<
	N extends Joi.BoxSchema,
	T extends WebSocketMessages,
	Params extends Joi.BoxObjectSchema<N>
>(
	interactions: T,
	params: Params,
	start: (context: WebSocketUtils<T> & { params: Joi.extractType<Params> }) => void
): WebsocketRequestHandler {
	return function webSocket(ws: WebSocket, req: Request<Record<string, string>>): void {
		const context = wsFactory(ws, interactions);

		// Ensure valid input
		try {
			assertSchema(req.params, params);
		} catch (error) {
			if (error instanceof Joi.ValidationError) {
				// TODO: Test that this error message makes sense.
				return context.close(WebSocketCode.VIOLATED_CONTRACT, error.message);
			}
			console.error(error);
			return context.close(WebSocketCode.UNEXPECTED_CONDITION, "Internal error");
		}

		start({ ...context, params: req.params });
	};
}
