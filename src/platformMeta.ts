import { version } from "./version";

/** Recorded Finance's repo homepage. */
export const repoMain = "https://codeberg.org/RecordedFinance/recorded-finance";

/** Recorded Finance's homepage for filing new issues. */
export const repoNewIssue = `${repoMain}/issues/new/choose` as const;

/** Recorded Finance's repo URL for the current version tag. */
export const repo = `${repoMain}/src/tag/v${version}` as const;

/**
 * Returns our {@link repo} URL string with the given `hash` appended.
 *
 * @example
 * ```ts
 * repoReadmeHeading("why-use-cookies")
 * // Returns "https://codeberg.org/RecordedFinance/recorded-finance/src/tag/{version}/README.md#why-use-cookies"
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
 * // Returns "https://codeberg.org/RecordedFinance/recorded-finance/src/tag/{version}/LICENSE"
 * ```
 */
export function repoFile<P extends string>(path: P): `${typeof repo}/${typeof path}` {
	return `${repo}/${path}`;
}
