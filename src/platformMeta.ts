import { version } from "./version";

/** Accountable's repo homepage. */
export const repoMain = "https://github.com/AverageHelper/recorded-finance";

/** Accountable's homepage for filing new issues. */
export const repoNewIssue = `${repoMain}/issues/new/choose` as const;

/** Accountable's repo URL for the current version tag. */
export const repo = `${repoMain}/tree/v${version}` as const;

/**
 * Returns our {@link repo} URL string with the given `hash` appended.
 *
 * @example
 * ```ts
 * repoReadmeHeading("why-use-cookies")
 * // Returns "https://github.com/AverageHelper/recorded-finance/tree/v10.0.1/README.md#why-use-cookies"
 * ```
 */
export function repoReadmeHeading<H extends string>(
	hash: H
): `${typeof repo}/README.md#${typeof hash}` {
	return `${repo}/README.md#${hash}`;
}

/**
 * Returns our {@link repo} URL with the given `path` appended.
 *
 * @example
 * ```ts
 * repoFile("LICENSE")
 * // Returns "https://github.com/AverageHelper/recorded-finance/tree/v10.0.1/LICENSE"
 * ```
 */
export function repoFile<P extends string>(path: P): `${typeof repo}/${typeof path}` {
	return `${repo}/${path}`;
}
