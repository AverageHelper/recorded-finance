#!/usr/bin/env ts-node

import "../helpers/assertTsNode";
import type { CollectionID, UID } from "../database/schemas";
import { allCollectionIds, CollectionReference } from "../database";
import { logger } from "../logger";
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
	const userCount = await numberOfUsers();
	const jwtCount = await numberOfExpiredJwts();

	const uids = await listAllUserIds();
	logger.info(`We have ${userCount} user(s):`, uids);

	// Compile the results...
	const users = (await Promise.all(uids.map(userWithUid))).filter(isNotNull);
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
		logger.info(`Stats for user ${uid}:`);

		const fileCount = fileCountsByUser.get(uid) ?? 0;
		logger.info(`\tFiles:  ${fileCount} record(s)`);

		for (const [collectionId, count] of counts) {
			logger.info(`\t${collectionId}:  ${count} record(s)`);
		}
	}

	logger.info(`Total expired JWTs:  ${jwtCount}`);
}

void main();
