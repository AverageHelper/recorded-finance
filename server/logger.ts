/**
 * A simple logging interface that may send its messages to
 * an aggregation utility. STDOUT and STDERR are only used in
 * debug modes.
 */
export const logger = {
	// TODO: Do better
	debug: (message?: unknown, ...optionalParams: Array<unknown>): void =>
		debugLogger.debug(message, ...optionalParams),
	info: (message?: unknown, ...optionalParams: Array<unknown>): void =>
		debugLogger.info(message, ...optionalParams),
	warn: (message?: unknown, ...optionalParams: Array<unknown>): void =>
		debugLogger.warn(message, ...optionalParams),
	error: (message?: unknown, ...optionalParams: Array<unknown>): void =>
		debugLogger.error(message, ...optionalParams),
};

/**
 * A simple logging interface that only sends its messages to
 * STDOUT and STDERR.
 */
export const debugLogger = {
	/* eslint-disable no-console */
	debug: (message?: unknown, ...optionalParams: Array<unknown>): void =>
		console.debug(message, ...optionalParams),
	info: (message?: unknown, ...optionalParams: Array<unknown>): void =>
		console.info(message, ...optionalParams),
	warn: (message?: unknown, ...optionalParams: Array<unknown>): void =>
		console.warn(message, ...optionalParams),
	error: (message?: unknown, ...optionalParams: Array<unknown>): void =>
		console.error(message, ...optionalParams),
	/* eslint-enable no-console */
};
