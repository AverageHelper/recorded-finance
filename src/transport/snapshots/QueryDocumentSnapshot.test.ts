import type { CollectionReference, DocumentReference, PlatformDB } from "../db.js";
import { describe, expect, test } from "vitest";
import { QueryDocumentSnapshot } from "./QueryDocumentSnapshot.js";

describe("QueryDocumentSnapshot", () => {
	test("throws if `data` was somehow `null`", () => {
		const db = "db-i-promise" as unknown as PlatformDB;
		const colRef: CollectionReference<object> = {
			db,
			type: "collection",
			id: "transactions",
		};
		const docRef: DocumentReference<object> = {
			db,
			type: "document",
			parent: colRef,
			id: "test",
		};

		const snap = new QueryDocumentSnapshot(docRef, null as unknown as object);
		expect(() => snap.data()).toThrow(TypeError);
	});
});
