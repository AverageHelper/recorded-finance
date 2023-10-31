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

export interface Logger extends BaseLogger {}

const baseLogger = console;

/**
 * A simple logging interface that only sends its messages to
 * STDOUT and STDERR.
 */
export const logger: Logger = {
	debug: (message, ...optionalParams) => {
		if (message instanceof Error) {
			baseLogger.debug(message, ...optionalParams);
		} else if (typeof message === "string") {
			baseLogger.debug(message, ...optionalParams);
		} else {
			baseLogger.debug(JSON.stringify(message), ...optionalParams);
		}
	},
	info: (message, ...optionalParams) => {
		if (message instanceof Error) {
			baseLogger.info(message, ...optionalParams);
		} else if (typeof message === "string") {
			baseLogger.info(message, ...optionalParams);
		} else {
			baseLogger.info(JSON.stringify(message), ...optionalParams);
		}
	},
	warn: (message, ...optionalParams) => {
		if (message instanceof Error) {
			baseLogger.warn(message, ...optionalParams);
		} else if (typeof message === "string") {
			baseLogger.warn(message, ...optionalParams);
		} else {
			baseLogger.warn(JSON.stringify(message), ...optionalParams);
		}
	},
	error: (message, ...optionalParams) => {
		if (message instanceof Error) {
			baseLogger.error(message, ...optionalParams);
		} else if (typeof message === "string") {
			baseLogger.error(message, ...optionalParams);
		} else {
			baseLogger.error(JSON.stringify(message), ...optionalParams);
		}
	},
};
