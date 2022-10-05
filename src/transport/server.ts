import type { AccountableDB } from "./db";
import { getFrom, urlForApi, version } from "./api-types/index.js";
import { t } from "../i18n";
import { UnexpectedResponseError } from "./errors/index.js";

/**
 * Asks the database server what its current version is.
 *
 * @returns The server's reported version string.
 */
export async function getServerVersion(db: AccountableDB): Promise<string> {
	const response = await getFrom(urlForApi(db, version()));
	if (response.version === undefined || !response.version)
		throw new UnexpectedResponseError(t("error.server.no-version"));

	return response.version;
}
