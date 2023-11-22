import type { Context } from "hono";
import type { Server as HTTPServer } from "node:http";
import type { Infer, Struct } from "superstruct";
import type { ReadonlyDeep } from "type-fest";
import type { ServerType } from "@hono/node-server/dist/types";
import type { User } from "../database/schemas";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import { InternalError } from "../errors/InternalError";
import { literal, type, unknown, validate } from "superstruct";
import { isWebSocketCode, WebSocketCode } from "./WebSocketCode";
import { logger } from "../logger";
import { UpgradeRequiredError } from "../errors/UpgradeRequiredError";
import { WebSocketError } from "../errors/WebSocketError";
import { HttpStatusCode } from "../helpers/HttpStatusCode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebSocketMessages = Record<string, Struct<any, any>>;

interface WebSocketUtils<T extends WebSocketMessages, Params extends object> {
	/** The context of the request that initiated the connection. */
	context: Context<Env>;

	/** The logged-in user. Only authenticated users may start WebSocket connections. */
	user: User;

	/** Params to the connection, usually derived from the request path. */
	params: Params;

	/**
	 * Registers a function to be called when the connection closes.
	 * Use this as an opportunity to clean up session-dependent resources.
	 */
	onClose: (cb: (code: WebSocketCode, reason: string) => void) => void;

	/**
	 * Registers a function to be called when the client sends
	 * a message via the websocket.
	 */
	onMessage: <K extends keyof T, G extends T[K]>(name: K, cb: (data: Infer<G>) => void) => void;

	/** Sends a message to the client via the websocket. */
	send: <K extends keyof T, G extends T[K]>(name: K, data: ReadonlyDeep<Infer<G>>) => void;

	/** Closes the websocket. */
	close: (code: WebSocketCode, reason: string) => void;
}

/**
 * Constructs a type-safe websocket interface.
 *
 * @param user The user who initiated the connection.
 * @param params Params to the connection, usually derived from the request path.
 * @param ws The {@link WebSocket} instance by which to send and receive messages.
 * @param interactions The types of interactions expected to be sent over the connection.
 *
 * @returns An object with utility functions to use to interact with the client.
 */
export function wsFactory<T extends WebSocketMessages, Params extends object>(
	context: Context<Env>,
	user: User,
	params: Params,
	ws: WebSocket,
	interactions: T
): WebSocketUtils<T, Params> {
	interface _WebSocketMessage<M extends keyof T> {
		name: M;
		data: Infer<T[M]>;
	}

	function assertWebSocketMessage<M extends keyof T>(
		name: M,
		tbd: unknown
	): asserts tbd is _WebSocketMessage<M> {
		const webSocketMessage = type({
			name: literal(name as string),
			data: unknown(),
		});

		const [error, message] = validate(tbd, webSocketMessage, { coerce: true });
		if (error) {
			logger.warn("[WebSocket]", error);
			throw new WebSocketError(WebSocketCode.WRONG_MESSAGE_TYPE, error.message);
		}

		// check name
		const guard = interactions[name];
		if (!guard) {
			const error = `Unknown interaction name '${String(name)}'`;
			logger.warn("[WebSocket]", error);
			throw new WebSocketError(WebSocketCode.WRONG_MESSAGE_TYPE, error);
		}

		// check data
		const [dataError] = validate(message.data, guard, { coerce: true });
		if (dataError) {
			logger.warn("[WebSocket]", dataError);
			throw new WebSocketError(WebSocketCode.VIOLATED_CONTRACT, dataError.message);
		}
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
		context,
		user,
		params,

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
					assertWebSocketMessage(name, message);

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

/** The Node webserver. This handle is used for attaching a WebSocketServer object. */
let _server: HTTPServer | undefined;

/**
 * Bootstraps a WebSocket server.
 *
 * @param server The result of calling Hono's `serve` function on a Hono instance.
 */
export function honoWs(server: ServerType): void {
	if (_server) throw new TypeError("You must only call `honoWs` once.");
	if (!("maxHeadersCount" in server)) throw new TypeError("Wrong server type.");
	_server = server;
}

/**
 * Creates a WebSocket request handler interface.
 *
 * @param interactions The kinds of interactions which should be allowed on the connection.
 * @param beforeStart A function that's called before setting up the socket connection. Errors
 *   thrown here will be forwarded to the caller as HTTP errors, like a normal request. Must return
 *   an authorized {@link User} object and validated params for context.
 * @param start A function that's called just after the connection starts. Errors thrown here
 *   will close the socket connection and
 * @returns An API request handler.
 */
export function ws<P extends string, Params extends object, T extends WebSocketMessages>(
	interactions: T,
	beforeStart: (context: Context<Env, P>) => [User, Params] | Promise<[User, Params]>,
	start: (connection: WebSocketUtils<T, Params>) => void
): APIRequestHandler<P> {
	return async function webSocket(c): Promise<Response> {
		const upgradeHeader = c.req.header("Upgrade");
		if (upgradeHeader !== "websocket") {
			throw new UpgradeRequiredError();
		}

		if (!_server) {
			throw new TypeError("Tried to execute a WebSocket endpoint before `honoWs` was called.");
		}

		const [user, params] = await beforeStart(c);

		// See https://github.com/honojs/hono/issues/1153#issuecomment-1785070637
		const wss = new WebSocketServer({ server: _server });
		wss.on("connection", socket => {
			const connection = wsFactory(c, user, params, socket, interactions);
			try {
				start(connection);
			} catch (error) {
				if (error instanceof WebSocketError) {
					connection.close(error.code, error.reason);
				} else if (error instanceof InternalError) {
					connection.close(WebSocketCode.UNEXPECTED_CONDITION, error.message);
				} else {
					connection.close(WebSocketCode.UNEXPECTED_CONDITION, "Internal error");
				}
			}
		});

		return new Response(null, {
			status: HttpStatusCode.SWITCHING_PROTOCOLS,
		});
	};
}
