import { env } from "../environment.js";
import { simplifiedByteCount } from "../transformers/index.js";
import getFolderSize from "get-folder-size";

const defaultMaxUsers = 5;
export const MAX_USERS = Number.parseInt(env("MAX_USERS") ?? `${defaultMaxUsers}`, 10);

// Check disk capacity
const defaultMaxSpace = 20000000000;
const totalSpace = Number.parseInt(env("MAX_BYTES") ?? `${defaultMaxSpace}`, 10);
export const maxSpacePerUser = totalSpace / MAX_USERS;

if ((process.env.NODE_ENV as string) !== "test") {
	process.stdout.write(
		`We have ${simplifiedByteCount(totalSpace)} available. That's ${simplifiedByteCount(
			maxSpacePerUser
		)} for each of our ${MAX_USERS} max users.\n`
	);
}

export const folderSize = getFolderSize.loose;
