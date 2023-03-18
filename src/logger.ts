/**
 * The basic interface used by the Console API.
 */
interface BaseLogger {
	/**
	 * Logs a debug message.
	 */
	debug: (message?: unknown, ...optionalParams: ReadonlyArray<unknown>) => void;

	/**
	 * Logs an informational message.
	 */
	info: (message?: unknown, ...optionalParams: ReadonlyArray<unknown>) => void;

	/**
	 * Logs a warning.
	 */
	warn: (message?: unknown, ...optionalParams: ReadonlyArray<unknown>) => void;

	/**
	 * Logs an error.
	 */
	error: (message?: unknown, ...optionalParams: ReadonlyArray<unknown>) => void;
}

interface Logger extends BaseLogger {}

/**
 * A simple logging interface that may send its messages to
 * an aggregation utility. STDOUT and STDERR are only used in
 * debug modes.
 */
export const logger: Logger = {
	// TODO: Try Pino + Logflare
	debug: (message, ...optionalParams) => debugLogger.debug(message, ...optionalParams),
	info: (message, ...optionalParams) => debugLogger.info(message, ...optionalParams),
	warn: (message, ...optionalParams) => debugLogger.warn(message, ...optionalParams),
	error: (message, ...optionalParams) => debugLogger.error(message, ...optionalParams),
};

// TODO: Audit logger messages for personal data, and fix that

/**
 * A simple logging interface that only sends its messages to
 * STDOUT and STDERR.
 */
export const debugLogger: Logger = {
	/* eslint-disable no-console */
	// TODO: Try Pino
	debug: (message, ...optionalParams) => console.debug(message, ...optionalParams),
	info: (message, ...optionalParams) => console.info(message, ...optionalParams),
	warn: (message, ...optionalParams) => console.warn(message, ...optionalParams),
	error: (message, ...optionalParams) => console.error(message, ...optionalParams),
	/* eslint-enable no-console */
};
