import { parser } from "keep-a-changelog";
import { readFileSync, writeFileSync } from "node:fs";
import { URL } from "node:url";

// fix the changelog's footer links and bumps the `version` in [package.json](/package.json) and [package-lock.json](/package-lock.json).

function quote(str: string | undefined): string | undefined {
	if (str === undefined) return str;
	return `'${str}'`;
}

// Load the changelog
const changelogPath = new URL("../CHANGELOG.md", import.meta.url).pathname;
console.info(`Loading changelog from '${changelogPath}'\n`);

const changelog = parser(readFileSync(changelogPath, "utf-8"));
console.info(`${changelog.description}\n`);

const releases = changelog.releases;

// Get 'Unreleased' if it exists
const unreleasedRelease = releases[0];
const unreleasedReleaseCompareLink = unreleasedRelease?.getCompareLink(changelog);
console.info("unreleasedReleaseCompareLink:", quote(unreleasedReleaseCompareLink));

// Get current versioned release
const thisReleaseIdx = releases.findIndex(release => release.date && release.version);
const thisRelease = releases[thisReleaseIdx];
if (!thisRelease?.version) throw new TypeError("No versioned release was found.");

// Handy info
console.info("latest release:", thisRelease.version?.toString());

const compareLink = thisRelease.getCompareLink(changelog);
console.info("compare link:", quote(compareLink));

const prevRelease = releases[thisReleaseIdx + 1];
console.info("previous release:", prevRelease?.version?.toString());

// Fix the changelog's format (new compare links, etc.)
const newChangelog = changelog.toString();
console.info(`Writing new changelog to '${changelogPath}'`);
writeFileSync(changelogPath, newChangelog);
console.info("Written!");
