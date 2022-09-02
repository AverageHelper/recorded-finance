/**
 * Standard close codes based on https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1
 */
export enum WebSocketCode {
	/**
	 * Indicates a normal closure, meaning that the purpose for
	 * which the connection was established has been fulfilled.
	 */
	NORMAL = 1000,

	/**
	 * Indicates that an endpoint is "going away", such as a server
	 * going down or a browser having navigated away from a page.
	 */
	WENT_AWAY = 1001,

	/**
	 * Indicates that an endpoint is terminating the connection due
	 * to a protocol error.
	 */
	PROTOCOL_ERROR = 1002,

	/**
	 * Indicates that an endpoint is terminating the connection
	 * because it has received a type of data it cannot accept (e.g., an
	 * endpoint that understands only text data MAY send this if it
	 * receives a binary message).
	 */
	WRONG_MESSAGE_TYPE = 1003,

	/**
	 * A reserved value that MUST NOT be set as a status code in a
	 * Close control frame by an endpoint.  It is designated for use in
	 * applications expecting a status code to indicate that the
	 * connection was closed abnormally, e.g., without sending or
	 * receiving a Close control frame.
	 */
	__UNKNOWN_STATE = 1006,

	/**
	 * Indicates that an endpoint is terminating the connection
	 * because it has received data within a message that was not
	 * consistent with the type of the message (e.g., non-UTF-8 [RFC3629]
	 * data within a text message).
	 */
	INCONSISTENT_MESSAGE = 1007,

	/**
	 * Indicates that an endpoint is terminating the connection
	 * because it has received a message that violates its policy.  This
	 * is a generic status code that can be returned when there is no
	 * other more suitable status code (e.g., 1003 or 1009) or if there
	 * is a need to hide specific details about the policy.
	 */
	VIOLATED_CONTRACT = 1008,

	/**
	 * Indicates that an endpoint is terminating the connection
	 * because it has received a message that is too big for it to
	 * process.
	 */
	MESSAGE_TOO_BIG = 1009,

	/**
	 * Indicates that a server is terminating the connection because
	 * it encountered an unexpected condition that prevented it from
	 * fulfilling the request.
	 */
	UNEXPECTED_CONDITION = 1011,

	/*
	 * 4000-4999
	 *
	 * Status codes in the range 4000-4999 are reserved for private use
	 * and thus can't be registered.  Such codes can be used by prior
	 * agreements between WebSocket applications.  The interpretation of
	 * these codes is undefined by this protocol.
	 */
}

export function isWebSocketCode(tbd: unknown): tbd is WebSocketCode {
	return Object.values(WebSocketCode).includes(tbd as WebSocketCode);
}
