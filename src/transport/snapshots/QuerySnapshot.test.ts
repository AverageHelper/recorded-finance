import type { CollectionReference, DocumentReference, PlatformDB, Query } from "../db.js";
import { describe, expect, test, vi } from "vitest";
import { QueryDocumentSnapshot } from "./QueryDocumentSnapshot.js";
import { QuerySnapshot } from "./QuerySnapshot.js";

describe("QuerySnapshot", () => {
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
	const doc1Ref: DocumentReference<typeof testData> = {
		db,
		type: "document",
		parent: colRef,
		id: "test1",
	};
	const doc2Ref = { ...doc1Ref, id: "test2" };
	const doc3Ref = { ...doc1Ref, id: "test3" };

	const query: Query<typeof testData> = { db, type: "query" };

	const doc1Snap = new QueryDocumentSnapshot(doc1Ref, testData);
	const doc2Snap = new QueryDocumentSnapshot(doc2Ref, testData);
	const doc3Snap = new QueryDocumentSnapshot(doc3Ref, testData);

	describe("plain query", () => {
		const query: Query<typeof testData> = { db, type: "query" };

		describe("`forEach`", () => {
			test("does nothing for an empty snap", () => {
				const mockCallback = vi.fn();
				const snap = new QuerySnapshot(query, []);

				snap.forEach(mockCallback);
				expect(mockCallback).not.toHaveBeenCalled();
			});

			test("iterates over the only doc", () => {
				const mockCallback = vi.fn();
				const snap = new QuerySnapshot(query, [doc1Snap]);

				snap.forEach(mockCallback);
				expect(mockCallback).toHaveBeenCalledTimes(1);
			});

			test("iterates over each doc", () => {
				const mockCallback = vi.fn();
				const snap = new QuerySnapshot(query, [doc1Snap, doc2Snap]);

				snap.forEach(mockCallback);
				expect(mockCallback).toHaveBeenCalledTimes(2);
			});
		});

		describe("`empty`", () => {
			test("returns `true` if there are no docs", () => {
				const snap = new QuerySnapshot(query, []);
				expect(snap.empty).toBe(true);
			});

			test("returns `false` if there is one doc", () => {
				const snap = new QuerySnapshot(query, [doc1Snap]);
				expect(snap.empty).toBe(false);
			});

			test("returns `false` if there is more than one doc", () => {
				const snap = new QuerySnapshot(query, [doc1Snap, doc2Snap]);
				expect(snap.empty).toBe(false);
			});
		});

		describe("`size`", () => {
			test("returns 0 docs if there are no docs", () => {
				const snap = new QuerySnapshot(query, []);
				expect(snap.size).toBe(0);
			});

			test("returns 1 doc if there is 1 doc", () => {
				const snap = new QuerySnapshot(query, [doc1Snap]);
				expect(snap.size).toBe(1);
			});

			test("returns 2 docs if there are 2 docs", () => {
				const snap = new QuerySnapshot(query, [doc1Snap, doc2Snap]);
				expect(snap.size).toBe(2);
			});
		});

		describe("`docChanges`", () => {
			test("returns an empty array if the snapshot is empty", () => {
				const snap = new QuerySnapshot(query, []);
				const changes = snap.docChanges();
				expect(Array.isArray(changes)).toBe(true);
				expect(changes.length).toBe(0);
			});

			test("all elements of the array are 'added'", () => {
				const snap = new QuerySnapshot(query, [doc1Snap, doc2Snap]);
				const changes = snap.docChanges();
				expect(Array.isArray(changes)).toBe(true);
				expect(changes.length).toBe(2);

				const first = changes[0];
				expect(first).toBeDefined();
				expect(first?.type).toBe("added");
				expect(first?.oldIndex).toBe(-1);
				expect(first?.newIndex).toBe(0);
				expect(first?.doc).toBe(doc1Snap);

				const second = changes[1];
				expect(second).toBeDefined();
				expect(second?.type).toBe("added");
				expect(second?.oldIndex).toBe(-1);
				expect(second?.newIndex).toBe(1);
				expect(second?.doc).toBe(doc2Snap);
			});
		});
	});

	describe("from a previous snapshot", () => {
		test("the `query` property matches that of the given snap", () => {
			const ogSnap = new QuerySnapshot(query, []);
			const snap = new QuerySnapshot(ogSnap, ogSnap.docs);
			expect(snap.query).toBe(ogSnap.query);
			expect(snap.query).toBe(query);
		});

		describe("`forEach`", () => {
			test("does nothing for an empty snap", () => {
				const mockCallback = vi.fn();
				const ogSnap = new QuerySnapshot(query, []);
				const snap = new QuerySnapshot(ogSnap, ogSnap.docs);

				snap.forEach(mockCallback);
				expect(mockCallback).not.toHaveBeenCalled();
			});

			test("iterates over the only doc", () => {
				const mockCallback = vi.fn();
				const ogSnap = new QuerySnapshot(query, [doc1Snap]);
				const snap = new QuerySnapshot(ogSnap, ogSnap.docs);

				snap.forEach(mockCallback);
				expect(mockCallback).toHaveBeenCalledTimes(1);
			});

			test("iterates over each doc", () => {
				const mockCallback = vi.fn();
				const ogSnap = new QuerySnapshot(query, [doc1Snap, doc2Snap]);
				const snap = new QuerySnapshot(ogSnap, ogSnap.docs);

				snap.forEach(mockCallback);
				expect(mockCallback).toHaveBeenCalledTimes(2);
			});
		});

		describe("`empty`", () => {
			test("returns `true` if there are no docs", () => {
				const ogSnap = new QuerySnapshot(query, []);
				const snap = new QuerySnapshot(ogSnap, ogSnap.docs);
				expect(snap.empty).toBe(true);
			});

			test("returns `false` if there is one doc", () => {
				const ogSnap = new QuerySnapshot(query, [doc1Snap]);
				const snap = new QuerySnapshot(ogSnap, ogSnap.docs);
				expect(snap.empty).toBe(false);
			});

			test("returns `false` if there is more than one doc", () => {
				const ogSnap = new QuerySnapshot(query, [doc1Snap, doc2Snap]);
				const snap = new QuerySnapshot(ogSnap, ogSnap.docs);
				expect(snap.empty).toBe(false);
			});
		});

		describe("`size`", () => {
			test("returns 0 docs if there are no docs", () => {
				const ogSnap = new QuerySnapshot(query, []);
				const snap = new QuerySnapshot(ogSnap, ogSnap.docs);
				expect(snap.size).toBe(0);
			});

			test("returns 1 doc if there is 1 doc", () => {
				const ogSnap = new QuerySnapshot(query, [doc1Snap]);
				const snap = new QuerySnapshot(ogSnap, ogSnap.docs);
				expect(snap.size).toBe(1);
			});

			test("returns 2 docs if there are 2 docs", () => {
				const ogSnap = new QuerySnapshot(query, [doc1Snap, doc2Snap]);
				const snap = new QuerySnapshot(ogSnap, ogSnap.docs);
				expect(snap.size).toBe(2);
			});
		});

		describe("`docChanges`", () => {
			test("returns an empty array if the snapshot is empty", () => {
				const ogSnap = new QuerySnapshot(query, []);
				const snap = new QuerySnapshot(ogSnap, ogSnap.docs);
				const changes = snap.docChanges();
				expect(Array.isArray(changes)).toBe(true);
				expect(changes.length).toBe(0);
			});

			test("returns one 'added' doc when new snapshot is a strict superset of the old snapshot", () => {
				const ogSnap = new QuerySnapshot(query, [doc1Snap]);
				const snap = new QuerySnapshot(ogSnap, ogSnap.docs.concat(doc2Snap));

				const changes = snap.docChanges();
				expect(Array.isArray(changes)).toBe(true);
				expect(changes.length).toBe(1);
				for (const change of changes) {
					expect(change.type).toBe("added");
					expect(change.oldIndex).toBe(-1);
					expect(change.newIndex).toBe(1);
					expect(change.doc).toBe(doc2Snap);
				}
			});

			test("returns all 'added' docs when new snapshot is a strict superset of the old snapshot", () => {
				const ogSnap = new QuerySnapshot(query, []);
				const snap = new QuerySnapshot(ogSnap, [doc1Snap, doc2Snap]);

				const changes = snap.docChanges();
				expect(Array.isArray(changes)).toBe(true);
				expect(changes.length).toBe(2);

				const first = changes[0];
				expect(first).toBeDefined();
				expect(first?.type).toBe("added");
				expect(first?.oldIndex).toBe(-1);
				expect(first?.newIndex).toBe(0);
				expect(first?.doc).toBe(doc1Snap);

				const second = changes[1];
				expect(second).toBeDefined();
				expect(second?.type).toBe("added");
				expect(second?.oldIndex).toBe(-1);
				expect(second?.newIndex).toBe(1);
				expect(second?.doc).toBe(doc2Snap);
			});

			test("returns one 'removed' doc when new snapshot is a strict subset of the old snapshot", () => {
				const ogSnap = new QuerySnapshot(query, [doc1Snap]);
				const snap = new QuerySnapshot(ogSnap, []);

				const changes = snap.docChanges();
				expect(Array.isArray(changes)).toBe(true);
				expect(changes.length).toBe(1);
				for (const change of changes) {
					expect(change.type).toBe("removed");
					expect(change.oldIndex).toBe(0);
					expect(change.newIndex).toBe(-1);
					expect(change.doc).toBe(doc1Snap);
				}
			});

			test("returns all 'removed' docs when new snapshot is a strict subset of the old snapshot", () => {
				const ogSnap = new QuerySnapshot(query, [doc1Snap, doc2Snap]);
				const snap = new QuerySnapshot(ogSnap, []);

				const changes = snap.docChanges();
				expect(Array.isArray(changes)).toBe(true);
				expect(changes.length).toBe(2);

				const first = changes[0];
				expect(first).toBeDefined();
				expect(first?.type).toBe("removed");
				expect(first?.oldIndex).toBe(0);
				expect(first?.newIndex).toBe(-1);
				expect(first?.doc).toBe(doc1Snap);

				const second = changes[1];
				expect(second).toBeDefined();
				expect(second?.type).toBe("removed");
				expect(second?.oldIndex).toBe(1);
				expect(second?.newIndex).toBe(-1);
				expect(second?.doc).toBe(doc2Snap);
			});

			test("returns one 'modified' doc", () => {
				const ogSnap = new QuerySnapshot(query, [doc1Snap, doc2Snap]);
				const newDoc2Snap = new QueryDocumentSnapshot(doc2Ref, { ...testData, one: 2 });
				const snap = new QuerySnapshot(ogSnap, [doc1Snap, newDoc2Snap]);

				const changes = snap.docChanges();
				expect(Array.isArray(changes)).toBe(true);
				expect(changes.length).toBe(1);
				for (const change of changes) {
					expect(change.type).toBe("modified");
					expect(change.newIndex).toBe(change.oldIndex);
					expect(change.newIndex).toBe(1);
					expect(change.doc).toBe(newDoc2Snap);
				}
			});

			test("returns one added and one removed", () => {
				const ogSnap = new QuerySnapshot(query, [doc1Snap]);
				const snap = new QuerySnapshot(ogSnap, [doc2Snap]);

				const changes = snap.docChanges();
				expect(Array.isArray(changes)).toBe(true);
				expect(changes.length).toBe(2);

				const remove = changes.find(c => c.type === "removed");
				expect(remove).toBeDefined();
				expect(remove?.doc).toBe(doc1Snap);
				expect(remove?.oldIndex).toBe(0);
				expect(remove?.newIndex).toBe(-1);

				const add = changes.find(c => c.type === "added");
				expect(add).toBeDefined();
				expect(add?.doc).toBe(doc2Snap);
				expect(add?.oldIndex).toBe(-1);
				expect(add?.newIndex).toBe(0);
			});

			test("returns one added and one modified", () => {
				const ogSnap = new QuerySnapshot(query, [doc1Snap]);
				const newDoc1Snap = new QueryDocumentSnapshot(doc1Ref, { ...testData, one: 2 });
				const snap = new QuerySnapshot(ogSnap, [newDoc1Snap, doc2Snap]);

				const changes = snap.docChanges();
				expect(Array.isArray(changes)).toBe(true);
				expect(changes.length).toBe(2);

				const modify = changes.find(c => c.type === "modified");
				expect(modify).toBeDefined();
				expect(modify?.doc).toBe(newDoc1Snap);
				expect(modify?.oldIndex).toBe(0);
				expect(modify?.newIndex).toBe(0);

				const add = changes.find(c => c.type === "added");
				expect(add).toBeDefined();
				expect(add?.doc).toBe(doc2Snap);
				expect(add?.oldIndex).toBe(-1);
				expect(add?.newIndex).toBe(1);
			});

			test("returns one removed and one modified", () => {
				const ogSnap = new QuerySnapshot(query, [doc1Snap, doc2Snap]);
				const newDoc2Snap = new QueryDocumentSnapshot(doc2Ref, { ...testData, one: 2 });
				const snap = new QuerySnapshot(ogSnap, [newDoc2Snap]);

				const changes = snap.docChanges();
				expect(Array.isArray(changes)).toBe(true);
				expect(changes.length).toBe(2);

				const remove = changes.find(c => c.type === "removed");
				expect(remove).toBeDefined();
				expect(remove?.doc).toBe(doc1Snap);
				expect(remove?.oldIndex).toBe(0);
				expect(remove?.newIndex).toBe(-1);

				const modify = changes.find(c => c.type === "modified");
				expect(modify).toBeDefined();
				expect(modify?.doc).toBe(newDoc2Snap);
				expect(modify?.oldIndex).toBe(1);
				expect(modify?.newIndex).toBe(0);
			});

			test("returns one added, one removed, and one modified", () => {
				const ogSnap = new QuerySnapshot(query, [doc1Snap, doc2Snap]);
				const newDoc2Snap = new QueryDocumentSnapshot(doc2Ref, { ...testData, one: 2 });
				const snap = new QuerySnapshot(ogSnap, [newDoc2Snap, doc3Snap]);

				const changes = snap.docChanges();
				expect(changes).toBeDefined();

				const add = changes.find(c => c.type === "added");
				expect(add).toBeDefined();
				expect(add?.doc).toBe(doc3Snap);
				expect(add?.oldIndex).toBe(-1);
				expect(add?.newIndex).toBe(1);

				const remove = changes.find(c => c.type === "removed");
				expect(remove).toBeDefined();
				expect(remove?.doc).toBe(doc1Snap);
				expect(remove?.oldIndex).toBe(0);
				expect(remove?.newIndex).toBe(-1);

				const modify = changes.find(c => c.type === "modified");
				expect(modify).toBeDefined();
				expect(modify?.doc).toBe(newDoc2Snap);
				expect(modify?.oldIndex).toBe(1);
				expect(modify?.newIndex).toBe(0);
			});
		});
	});
});
