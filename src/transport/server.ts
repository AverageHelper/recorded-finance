import type { PlatformDB } from "./db";
import { run } from "./apiStruts";
import { t } from "../i18n";
import { UnexpectedResponseError } from "./errors";
import { version as getVersion } from "./api";

/**
 * Asks the database server what its current version is.
 *
 * @returns The server's reported version string.
 */
export async function getServerVersion(db: PlatformDB): Promise<string> {
	const response = await run(getVersion, db);
	if (response.version === undefined || !response.version)
		throw new UnexpectedResponseError(t("error.server.no-version"));

	return response.version;
}
