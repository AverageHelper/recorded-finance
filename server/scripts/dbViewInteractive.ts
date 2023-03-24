#!/usr/bin/env ts-node

import "../helpers/assertTsNode";
import type { CollectionID, IdentifiedDataItem, UID } from "../database/schemas";
import { allCollectionIds, isNonEmptyArray } from "../database/schemas";
import { fetchDbCollection, listAllUserIds, userWithUid } from "../database/read";
import { CollectionReference } from "../database/references";
import inquirer from "inquirer";
import ora from "ora";

async function main(): Promise<void> {
	const loadSpinner = ora("Reading '/database/users'").start();

	const uids = await Promise.all(await listAllUserIds(null));
	loadSpinner.succeed();

	uid: while (true) {
		const { uid } = await inquirer.prompt<{ uid: UID }>({
			type: "list",
			name: "uid",
			message: "/database/users/{uid}",
			choices: uids,
		});

		col: while (true) {
			const { collectionId } = await inquirer.prompt<{ collectionId: CollectionID | ".." }>({
				type: "list",
				name: "collectionId",
				message: `/database/users/${uid}/{collectionId}`,
				choices: [".."].concat(allCollectionIds.filter(id => id !== "users")),
			});

			if (collectionId === "..") {
				continue uid;
			}

			const userSpinner = ora(`Reading '/database/users/${uid}'`).start();
			const user = await userWithUid(uid, null);
			if (!user) {
				userSpinner.fail(`No user found for that UID.`);
				continue uid;
			}
			userSpinner.succeed();

			const ref = new CollectionReference(user, collectionId);
			const colSpinner = ora(`Reading '/database/${ref.path}'`).start();

			const collection = await fetchDbCollection(ref, null);

			if (!isNonEmptyArray(collection)) {
				colSpinner.succeed(`Reading '/database/${ref.path}'\nNo documents`);
				continue;
			}

			colSpinner.succeed(`Reading '/database/${ref.path}'\n${collection.length} document(s):`);
			while (true) {
				const { doc } = await inquirer.prompt<{ doc: IdentifiedDataItem | ".." }>({
					type: "list",
					name: "doc",
					message: `/database/users/${uid}/${collectionId}`,
					choices: [{ name: ".." }].concat(
						collection.map(d => ({
							name: d._id,
							value: d,
						}))
					),
				});

				if (doc === "..") {
					continue col;
				}

				console.info(JSON.stringify(doc, undefined, "\t"));
			}
		}
	}
}

void main();
