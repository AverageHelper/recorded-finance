import type { EnvKey } from "../environment.js";
import { tmpdir } from "node:os";

const mockDB = tmpdir();

export function env(key: EnvKey): string | undefined {
	switch (key) {
		case "AUTH_SECRET":
			return "wAheb^8v^YV^s6YaeYVW&8tyLa*ce4"; // from the README lol
		case "DB":
			return mockDB;
		default:
			return process.env[key];
	}
}

export function requireEnv(key: EnvKey): string {
	const result = env(key) ?? "";
	if (!result || typeof result !== "string")
		throw new TypeError(`Missing value for environment key ${key}`);
	return result;
}
