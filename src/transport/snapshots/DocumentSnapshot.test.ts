import type { CollectionReference, DocumentReference, PlatformDB } from "../db";
import { DocumentSnapshot } from "./DocumentSnapshot";

describe("DocumentSnapshot", () => {
	const testData = {
		one: 1,
		two: "2",
	};

	const db = "db-i-promise" as unknown as PlatformDB;
	const colRef: CollectionReference<typeof testData> = {
		db,
		type: "collection",
		id: "transactions",
	};
	const docRef: DocumentReference<typeof testData> = {
		db,
		type: "document",
		parent: colRef,
		id: "test",
	};
	const snap = new DocumentSnapshot(docRef, testData);

	test("id returns the doc ID", () => {
		expect(snap.id).toBe(docRef.id);
	});

	test("returns data", () => {
		expect(snap.data()).toBe(testData);
		expect(snap.exists()).toBeTrue();
	});

	test("returns no data for empty snap", () => {
		const emptySnap = new DocumentSnapshot(docRef, null);
		expect(emptySnap.data()).toBeUndefined();
		expect(emptySnap.exists()).toBeFalse();
	});
});
