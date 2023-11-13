#!/usr/bin/env ts-node

import { parser as changelogParser } from "keep-a-changelog";
import { debugLogger as logger } from "../src/logger.js";
import { readFileSync, writeFileSync } from "node:fs";
import { URL } from "node:url";

// Parses the changelog for 'version', 'description', 'versionMajor', and 'status' bits, and saves these into a local .release.env file.
// This script may be run repeatedly on the same project.

function quote(str: string | undefined): string | undefined {
	if (str === undefined) return str;
	return `'${str}'`;
}

logger.info("** createReleaseEnv.ts **");

// Load the changelog
const changelogPath = new URL("../CHANGELOG.md", import.meta.url).pathname;
logger.info("Loading changelog from", quote(changelogPath), "\n");

const rawChangelog = readFileSync(changelogPath, "utf-8");
const changelog = changelogParser(rawChangelog);

const releases = changelog.releases;

// Get current versioned release
const thisReleaseIdx = releases.findIndex(release => release.date && release.parsedVersion);
const thisRelease = releases[thisReleaseIdx];
if (!thisRelease?.parsedVersion || !thisRelease.version)
	throw new TypeError("No versioned release was found.");

// Handy info
logger.info("latest release:", thisRelease.version);

const prevRelease = releases[thisReleaseIdx + 1];
logger.info("previous release:", prevRelease?.version, "\n");

const version: string = thisRelease.version;
const isPrerelease: boolean =
	thisRelease.parsedVersion.prerelease.length > 0 || thisRelease.parsedVersion.major === 0;

function toTitleCase(str: string): string {
	const first = str[0];
	if (!first) return str;

	const rest = str.slice(1);
	return `${first.toUpperCase()}${rest}`;
}

// Because keep-a-changelog's description parser is bugged:
let description: string = "";
for (const [heading, changes] of thisRelease.changes) {
	if (changes.length === 0) continue;

	// Heading ('Added', 'Changed', etc.)
	description += "### ";
	description += toTitleCase(heading);
	description += "\n\n";

	// Contents (usually a list)
	for (const change of changes) {
		description += "- ";

		const lines = change.title.split("\n");
		for (const line of lines) {
			if (line.startsWith("- ")) {
				// Sub-list item
				description += "  ";
			}
			description += line;
			description += "\n";
		}
	}
}

// TODO: Write details to .release.env
const output = `NEW_RELEASE_VERSION=${version}
NEW_RELEASE_PRERELEASE=${isPrerelease}
NEW_RELEASE_DESCRIPTION=${JSON.stringify(description).replaceAll("\\n", "\n")}
`;

const releaseEnvPath = new URL("../.release.env", import.meta.url).pathname;
logger.info(output);

writeFileSync(releaseEnvPath, output);
logger.info(`Wrote values to '${releaseEnvPath}'`);
