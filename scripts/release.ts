import { parser } from "keep-a-changelog";
import { readFileSync, writeFileSync } from "node:fs";
import { URL } from "node:url";
import gitDiff from "git-diff";

// fix the changelog's footer links and bumps the `version` in [package.json](/package.json) and [package-lock.json](/package-lock.json).

function quote(str: string | undefined): string | undefined {
	if (str === undefined) return str;
	return `'${str}'`;
}

console.info("** release.ts **");

// Load the changelog
const changelogPath = new URL("../CHANGELOG.md", import.meta.url).pathname;
console.info("Loading changelog from", quote(changelogPath));

const rawChangelog = readFileSync(changelogPath, "utf-8");
const changelog = parser(rawChangelog);

const releases = changelog.releases;

// Get 'Unreleased' if it exists
const unreleasedRelease = releases[0];
if (unreleasedRelease) {
	console.info("Has 'Unreleased'");
}

// Get current versioned release
const thisReleaseIdx = releases.findIndex(release => release.date && release.version);
const thisRelease = releases[thisReleaseIdx];
if (!thisRelease?.version) throw new TypeError("No versioned release was found.");

// Handy info
console.info("latest release:", thisRelease.version?.toString());

const prevRelease = releases[thisReleaseIdx + 1];
console.info("previous release:", prevRelease?.version?.toString());

// Fix the changelog's format (new compare links, etc.), and print the diff of our changes
console.info("\n** Spec compliance **");

const newChangelog = changelog.toString();
writeFileSync(changelogPath, newChangelog);

const diff = gitDiff(rawChangelog, newChangelog, { color: true });
const didFix = diff !== undefined;
if (!didFix) {
	console.info("Changelog was already spec compliant.");
} else {
	console.info("Fixed formatting for spec compliance:");
	console.info(diff);
}

if (didFix)
	throw new EvalError("CHANGELOG.md was not spec compliant. Please review changes and re-run."); // this should fail us in CI
