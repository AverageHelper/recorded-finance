#!/usr/bin/env ts-node

import "../helpers/assertTsNode";
import type { CollectionID, UID } from "../database/schemas";
import { allCollectionIds } from "../database/schemas";
import { CollectionReference } from "../database/references";
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
	const recordCountsByUser = new Map<UID, Map<CollectionID, number>>();
	const fileCountsByUser = new Map<UID, number>();

	for (const user of users) {
		const uid = user.uid;
		const counts = new Map<CollectionID, number>();

		for (const collectionId of allCollectionIds) {
			const ref = new CollectionReference(user, collectionId);
			counts.set(collectionId, await countRecordsInCollection(ref));
		}

		recordCountsByUser.set(uid, counts);

		const fileCount = await countFileBlobsForUser(uid);
		fileCountsByUser.set(uid, fileCount);
	}

	// Print the results...
	for (const [uid, counts] of recordCountsByUser) {
		console.info(`Stats for user ${uid}:`);

		const fileCount = fileCountsByUser.get(uid) ?? 0;
		console.info(`\tFiles:  ${fileCount} record(s)`);

		for (const [collectionId, count] of counts) {
			console.info(`\t${collectionId}:  ${count} record(s)`);
		}
	}

	console.info(`Total expired JWTs:  ${jwtCount}`);
}

void main();
