import type { Context } from "hono";
import type { Infer, Struct } from "superstruct";
import type { ParamKeyToRecord, ParamKeys } from "hono/dist/types/types";
import type { ReadonlyDeep } from "type-fest";
import type { UnionToIntersection } from "hono/utils/types";
import type { WebSocket } from "@cloudflare/workers-types";
import { assert, literal, type, unknown } from "superstruct";
import { errorResponse, internalErrorResponse } from "../responses";
import { InternalError } from "../errors/InternalError";
import { isWebSocketCode, WebSocketCode } from "./WebSocketCode";
import { logger } from "../logger";
import { UpgradeRequiredError } from "../errors/UpgradeRequiredError";
import { WebSocketError } from "../errors/WebSocketError";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebSocketMessages = Record<string, Struct<any, any>>;

interface WebSocketUtils<T extends WebSocketMessages, P extends string> {
	/** The request that started the connection. */
	context: Context<Env, P>;

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
 * @param req The request that started the connection.
 * @param ws The {@link WebSocket} instance by which to send and receive messages.
 * @param interactions The types of interactions expected to be sent over the connection.
 *
 * @returns An object with utility functions to use to interact with the client.
 */
export function wsFactory<T extends WebSocketMessages, P extends string>(
	context: Context<Env, P>,
	ws: WebSocket,
	interactions: T
): WebSocketUtils<T, P> {
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

		try {
			assert(tbd, webSocketMessage);
		} catch (error) {
			logger.warn("[WebSocket]", error);
			throw new WebSocketError(WebSocketCode.WRONG_MESSAGE_TYPE, "Improper message");
		}

		// check name
		const guard = interactions[name];
		if (!guard) {
			logger.warn("[WebSocket]", `Unknown interaction name '${String(name)}'`);
			throw new WebSocketError(WebSocketCode.WRONG_MESSAGE_TYPE, "Improper message");
		}

		// check data
		try {
			assert(tbd.data, guard);
		} catch (error) {
			logger.warn("[WebSocket]", error);
			throw new WebSocketError(WebSocketCode.WRONG_MESSAGE_TYPE, "Improper message");
		}
	}

	function close(ws: WebSocket, code: WebSocketCode, reason: string): void {
		ws.close(code, reason);
	}

	function send<M extends keyof T>(ws: WebSocket, message: _WebSocketMessage<M>): void {
		ws.send(JSON.stringify(message));
	}

	// Application-layer communications
	return {
		context,

		onClose(cb): void {
			ws.addEventListener("close", ({ code, reason }) => {
				if (isWebSocketCode(code)) {
					cb(code, reason);
				} else {
					if (reason) {
						cb(
							WebSocketCode.UNEXPECTED_CONDITION,
							`Client closed the connection with reason "${reason}" and unknown code ${code}`
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
			ws.addEventListener("message", ({ data }) => {
				try {
					const textData = typeof data === "string" ? data : Buffer.from(data).toString("utf-8");
					const message = JSON.parse(textData) as unknown;
					assertWebSocketMessage(name, message);
					cb(message.data);
				} catch (error) {
					if (error instanceof WebSocketError) {
						close(ws, error.code, error.reason);
					} else {
						logger.error("[WebSocket] Unknown WebSocket message error:", error);
						close(ws, WebSocketCode.UNEXPECTED_CONDITION, "Internal error");
					}
				}
			});

			ws.addEventListener("error", error => {
				logger.error("[WebSocket] Websocket error:", error);
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

// See https://github.com/honojs/hono/issues/1153#issuecomment-1767321332
export function ws<P extends string, T extends WebSocketMessages>(
	interactions: T,
	start: (
		wsContext: WebSocketUtils<T, P>,
		params: UnionToIntersection<ParamKeyToRecord<ParamKeys<P>>>
	) => void | Promise<void>
): APIRequestHandler<P> {
	return async function webSocket(c): Promise<Response> {
		const upgradeHeader = c.req.header("Upgrade");
		if (upgradeHeader !== "websocket") {
			return errorResponse(c, new UpgradeRequiredError());
		}

		const webSocketPair = new WebSocketPair();
		const client = webSocketPair[0];
		const server = webSocketPair[1];
		server.accept();

		const context = wsFactory(c, server, interactions);

		try {
			await start(context, c.req.param());
		} catch (error) {
			if (error instanceof InternalError) {
				return errorResponse(c, error);
			}
			return internalErrorResponse(c);
		}

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	};
}
