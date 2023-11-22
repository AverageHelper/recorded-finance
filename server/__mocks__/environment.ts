import type * as environment from "../environment";
import { vi } from "vitest";

const { env: _env } = await vi.importActual<typeof environment>("../environment");

export function env(...[c, key]: Parameters<typeof _env>): string | undefined {
	switch (key) {
		case "AUTH_SECRET":
			return "wAheb^8v^YV^s6YaeYVW&8tyLa*ce4"; // from the README, not a secret
		case "NODE_ENV":
			return "test"; // FIXME: Should be able to define this in vitest.config.ts
		default:
			return _env(c, key);
	}
}

export function requireEnv(...[c, key]: Parameters<typeof environment.requireEnv>): string {
	const result = env(c, key) ?? "";
	if (!result || typeof result !== "string")
		throw new TypeError(`Missing value for environment key ${key}`);
	return result;
}
