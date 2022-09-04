import type { EnvKey } from "../environment.js";
import { tmpdir } from "node:os";

const mockDB = tmpdir();

export function env(key: EnvKey): string | undefined {
	switch (key) {
		case "AUTH_SECRET":
			return "not-special";
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
