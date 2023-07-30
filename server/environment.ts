import "dotenv/config"; // SIDE-EFFECT: populates `process.env`

export type EnvKey =
	| "AUTH_SECRET"
	| "CSRF_SECRET"
	| "HOST"
	| "MAX_BYTES"
	| "MAX_USERS"
	| "NODE_ENV"
	| "PUBNUB_PUBLISH_KEY"
	| "PUBNUB_SUBSCRIBE_KEY"
	| "PUBNUB_SECRET_KEY"
	| "VERCEL_URL";

/**
 * Retrieves an environment value for the given key, or `undefined` if none was set.
 *
 * @param key An environment variable key.
 * @returns The string stored for the environment variable key, or `undefined`
 */
export function env(key: EnvKey): string | undefined {
	return process.env[key];
}

/**
 * Retrieves an environment value for the given key.
 *
 * @param key An environment variable key.
 *
 * @throws A `TypeError` if the key has no associated value.
 * @returns The string stored for the environment variable key
 */
export function requireEnv(key: EnvKey): string {
	const result = env(key) ?? "";
	if (!result || typeof result !== "string")
		throw new TypeError(`Missing value for environment key ${key}`);
	return result;
}
