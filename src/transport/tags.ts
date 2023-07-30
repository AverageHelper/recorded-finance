import type {
	CollectionReference,
	DocumentReference,
	QueryDocumentSnapshot,
	WriteBatch,
} from "./db";
import type { EPackage } from "./cryptionProtocols";
import type { HashStore } from "./HashStore";
import type { Tag, TagRecordParams } from "../model/Tag";
import { encrypt } from "./cryption";
import { collection, db, doc, recordFromSnapshot, setDoc, deleteDoc } from "./db";
import { isTagRecord, recordFromTag, tag } from "../model/Tag";

export type TagRecordPackage = EPackage<"Tag">;

export function tagsCollection(): CollectionReference<TagRecordPackage> {
	return collection<TagRecordPackage>(db, "tags");
}

function tagRef(tag: Tag): DocumentReference<TagRecordPackage> {
	return doc<TagRecordPackage>(db, "tags", tag.id);
}

export async function tagFromSnapshot(
	doc: QueryDocumentSnapshot<TagRecordPackage>,
	dek: HashStore
): Promise<Tag> {
	const { id, record } = await recordFromSnapshot(doc, dek, isTagRecord);
	return tag({
		colorId: record.colorId,
		name: record.name,
		id,
	});
}

export async function createTag(
	record: TagRecordParams,
	dek: HashStore,
	batch?: WriteBatch
): Promise<Tag> {
	const pkg = await encrypt(record, "Tag", dek);
	const ref = doc(tagsCollection());
	if (batch) {
		batch.set(ref, pkg);
	} else {
		await setDoc(ref, pkg);
	}
	return tag({
		colorId: record.colorId,
		name: record.name,
		id: ref.id,
	});
}

export async function updateTag(tag: Tag, dek: HashStore, batch?: WriteBatch): Promise<void> {
	const record = recordFromTag(tag);
	const pkg = await encrypt(record, "Tag", dek);
	const ref = tagRef(tag);
	if (batch) {
		batch.set(ref, pkg);
	} else {
		await setDoc(ref, pkg);
	}
}

export async function deleteTag(tag: Tag, batch?: WriteBatch): Promise<void> {
	const ref = tagRef(tag);
	if (batch) {
		batch.delete(ref);
	} else {
		await deleteDoc(ref);
	}
}
