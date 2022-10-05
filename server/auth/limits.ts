import { env } from "../environment";
import { simplifiedByteCount } from "../transformers";

export const MAX_FILE_BYTES = 4404019; // 4.4 MB, to not exceed Vercel's 4.5 MB limit

const defaultMaxUsers = 5;
export const MAX_USERS = Number.parseInt(env("MAX_USERS") ?? `${defaultMaxUsers}`, 10);

// Check configured capacity
const defaultMaxSpace = 20000000000;
const totalSpace = Number.parseInt(env("MAX_BYTES") ?? `${defaultMaxSpace}`, 10);
export const maxSpacePerUser = totalSpace / MAX_USERS;

process.stdout.write(
	`We have ${simplifiedByteCount(totalSpace)} available. That's ${simplifiedByteCount(
		maxSpacePerUser
	)} for each of our ${MAX_USERS} max users.\n`
);
