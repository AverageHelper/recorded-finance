#!/usr/bin/env ts-node

import "../helpers/assertTsNode";
import type { CollectionID } from "../database";
import { allCollectionIds, CollectionReference } from "../database";
import {
	countFileBlobsForUser,
	countRecordsInCollection,
	listAllUserIds,
	numberOfExpiredJwts,
	numberOfUsers,
	userWithUid,
} from "../database/read";

function isNotNull<T>(tbd: T): tbd is NonNullable<T> {
	return tbd !== null;
}

async function main(): Promise<void> {
	// Read the database, and count up every record
	const userCount = await numberOfUsers(null);
	const jwtCount = await numberOfExpiredJwts(null);

	const uids = await listAllUserIds(null);
	console.info(`We have ${userCount} user(s):`, uids);

	// Compile the results...
	const users = (await Promise.all(uids.map(uid => userWithUid(uid, null)))).filter(isNotNull);
	const recordCountsByUser: Record<string, Partial<Record<CollectionID, number>>> = {};
	const fileCountsByUser: Record<string, number> = {};

	for (const user of users) {
		const uid = user.uid;
		const counts: Partial<Record<CollectionID, number>> = {};

		for (const collectionId of allCollectionIds) {
			const ref = new CollectionReference(user, collectionId);
			counts[collectionId] = await countRecordsInCollection(ref, null);
		}

		recordCountsByUser[uid] = counts;

		const fileCount = await countFileBlobsForUser(uid, null);
		fileCountsByUser[uid] = fileCount;
	}

	// Print the results...
	for (const [uid, counts] of Object.entries(recordCountsByUser)) {
		console.info(`Stats for user ${uid}:`);

		const fileCount = fileCountsByUser[uid] ?? 0;
		console.info(`\tFiles:  ${fileCount} record(s)`);

		for (const [collectionId, count] of Object.entries(counts)) {
			console.info(`\t${collectionId}:  ${count} record(s)`);
		}
	}

	console.info(`Total expired JWTs:  ${jwtCount}`);
}

void main();
