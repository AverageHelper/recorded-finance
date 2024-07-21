/**
 * Asserts (on import) that the running context is tsx.
 *
 * @throws an {@link EvalError} if `tsx` is not found on `process.env._`.
 *
 * See https://github.com/privatenumber/tsx/issues/49
 */

if (typeof process.env["_"] !== "string" || !process.env["_"].includes(".bin/tsx"))
	throw new EvalError(
		"Couldn't detect the tsx environment. Did you import this script as a module by mistake?"
	);

export {};
