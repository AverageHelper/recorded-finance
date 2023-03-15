#!/usr/bin/env ts-node

import "../helpers/assertTsNode";
import type { CollectionID, IdentifiedDataItem } from "../database/schemas";
import { allCollectionIds, isNonEmptyArray } from "../database/schemas";
import { fetchDbCollection, listAllUserIds, userWithUid } from "../database/read";
import { CollectionReference } from "../database/references";
import inquirer from "inquirer";
import ora from "ora";

async function main(): Promise<void> {
	const loadSpinner = ora("Reading '/database/users'").start();

	const uids = await Promise.all(await listAllUserIds(null));
	loadSpinner.succeed();

	const { uid, collectionId } = await inquirer.prompt<{ uid: string; collectionId: CollectionID }>([
		{
			type: "list",
			name: "uid",
			message: "/database/users/{uid}",
			choices: uids,
		},
		{
			type: "list",
			name: "collectionId",
			message: ({ uid }) => `/database/users/${uid}/{collectionId}`,
			choices: allCollectionIds.filter(id => id !== "users"),
		},
	]);

	const user = await userWithUid(uid, null);
	if (!user) return;
	const ref = new CollectionReference(user, collectionId);
	const userSpinner = ora(`Reading '/database/${ref.path}'`).start();

	const collection = await fetchDbCollection(ref, null);

	if (!isNonEmptyArray(collection)) {
		userSpinner.succeed("No documents");
		return;
	}

	if (collection.length === 1) {
		userSpinner.succeed(`1 document: ${JSON.stringify(collection[0], undefined, "\t")}`);
		return;
	}

	userSpinner.succeed(`${collection.length} documents:`);
	const { doc } = await inquirer.prompt<{ doc: IdentifiedDataItem }>({
		type: "list",
		name: "doc",
		message: `/database/users/${uid}/${collectionId}`,
		choices: collection.map(d => ({
			name: d._id,
			value: d,
		})),
	});

	console.info(JSON.stringify(doc, undefined, "\t"));
}

void main();
