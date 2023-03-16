import { env } from "../environment";
import { logger } from "../logger";
import { simplifiedByteCount } from "../transformers";

export const MAX_FILE_BYTES = 4_404_019; // 4.4 MB, to not exceed Vercel's 4.5 MB limit

const defaultMaxUsers = 5;
export const MAX_USERS = Number.parseInt(env("MAX_USERS") ?? `${defaultMaxUsers}`, 10);

// Check configured capacity
const defaultMaxSpace = 20_000_000_000;
const totalSpace = Number.parseInt(env("MAX_BYTES") ?? `${defaultMaxSpace}`, 10);
export const maxSpacePerUser = totalSpace / MAX_USERS;

// TODO: Some way to disable this
logger.debug(
	`We have ${simplifiedByteCount(totalSpace)} available. That's ${simplifiedByteCount(
		maxSpacePerUser
	)} for each of our ${MAX_USERS} max users.`
);
