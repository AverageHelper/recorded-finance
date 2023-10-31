import type { Context } from "hono";
import { env } from "../environment";
import { logger } from "../logger";
import { simplifiedByteCount } from "../transformers";

export const MAX_FILE_BYTES = 4_404_019; // 4.4 MB, to not exceed Vercel's 4.5 MB limit

const defaultMaxUsers = 5;
export function maxTotalUsers(c: Context<Env>): number {
	return Number.parseInt(env(c, "MAX_USERS") ?? `${defaultMaxUsers}`, 10);
}

// Check configured capacity
export function maxStorageSpacePerUser(c: Context<Env>): number {
	const defaultMaxSpace = 20_000_000_000;
	const totalSpace = Number.parseInt(env(c, "MAX_BYTES") ?? `${defaultMaxSpace}`, 10);
	const MAX_USERS = maxTotalUsers(c);
	const result = totalSpace / MAX_USERS;

	// TODO: Some way to disable this
	logger.debug(
		`We have ${simplifiedByteCount(totalSpace)} available. That's ${simplifiedByteCount(
			result
		)} for each of our ${MAX_USERS} max users.`
	);

	return result;
}
