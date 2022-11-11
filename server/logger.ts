/**
 * The basic interface used by the Console API.
 */
interface BaseLogger {
	debug: (message?: unknown, ...optionalParams: Array<unknown>) => void;
	info: (message?: unknown, ...optionalParams: Array<unknown>) => void;
	warn: (message?: unknown, ...optionalParams: Array<unknown>) => void;
	error: (message?: unknown, ...optionalParams: Array<unknown>) => void;
}

interface Logger extends BaseLogger {}

/**
 * A simple logging interface that may send its messages to
 * an aggregation utility. STDOUT and STDERR are only used in
 * debug modes.
 */
export const logger: Logger = {
	// TODO: Do better
	debug: (message, ...optionalParams) => debugLogger.debug(message, ...optionalParams),
	info: (message, ...optionalParams) => debugLogger.info(message, ...optionalParams),
	warn: (message, ...optionalParams) => debugLogger.warn(message, ...optionalParams),
	error: (message, ...optionalParams) => debugLogger.error(message, ...optionalParams),
};

// TODO: Transmit logger messages somewhere I can use them for debugging

/**
 * A simple logging interface that only sends its messages to
 * STDOUT and STDERR.
 */
export const debugLogger: Logger = {
	/* eslint-disable no-console */
	debug: (message, ...optionalParams) => console.debug(message, ...optionalParams),
	info: (message, ...optionalParams) => console.info(message, ...optionalParams),
	warn: (message, ...optionalParams) => console.warn(message, ...optionalParams),
	error: (message, ...optionalParams) => console.error(message, ...optionalParams),
	/* eslint-enable no-console */
};
