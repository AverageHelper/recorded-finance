import type { Context } from "hono";
import "dotenv/config"; // SIDE-EFFECT: populates `process.env`

/**
 * Retrieves an environment value for the given key, or `undefined` if none was set.
 *
 * @param c The request context.
 * @param key An environment variable key.
 * @returns The string stored for the environment variable key, or `undefined`
 */
export function env(c: Pick<Context<Env>, "env">, key: EnvKey): string | undefined {
	return c.env?.[key] ?? process.env[key];
}

/**
 * Retrieves an environment value for the given key.
 *
 * @param c The request context.
 * @param key An environment variable key.
 *
 * @throws A `TypeError` if the key has no associated value.
 * @returns The string stored for the environment variable key
 */
export function requireEnv(c: Pick<Context<Env>, "env">, key: EnvKey): string {
	const result = env(c, key) ?? "";
	if (!result || typeof result !== "string")
		throw new TypeError(`Missing value for environment key ${key}`);
	return result;
}
