import type { Context } from "hono";
import { env } from "../environment";
import { logger } from "../logger";
import { simplifiedByteCount } from "../transformers";

/**
 * The number of bytes in 4.4 MB, to not exceed Vercel's 4.5 MB transfer limit.
 */
export const MAX_FILE_BYTES = 4_404_019;

const defaultMaxUsers = 5;

/**
 * Returns the configured limit of registered users.
 *
 * This should be a soft limit, such that existing users are
 * not prevented from logging in if the limit has been
 * exceeded. Only new user registrations are prevented.
 */
export function maxTotalUsers(c: Context<Env>): number {
	return Number.parseInt(env(c, "MAX_USERS") ?? `${defaultMaxUsers}`, 10);
}

/**
 * Returns the configured file storage limit for users.
 */
// TODO: This should also count normal records, not just large files.
export function maxStorageSpacePerUser(c: Context<Env>): number {
	// Check configured capacity
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
