import type {
	CollectionReference,
	DocumentReference,
	QueryDocumentSnapshot,
	WriteBatch,
} from "./db";
import type { Attachment, AttachmentRecordParams } from "../model/Attachment";
import type { StorageReference } from "./storage.js";
import type { EPackage } from "./cryptionProtocols";
import type { HashStore } from "./HashStore";
import type { UID } from "./schemas";
import { attachment, isAttachmentRecord, recordFromAttachment } from "../model/Attachment";
import { collection, db, doc, recordFromSnapshot, setDoc, deleteDoc } from "./db";
import { dataUrlFromFile } from "./getDataAtUrl";
import { decrypt, encrypt } from "./cryption";
import { deleteObject, downloadString, ref, uploadString } from "./storage.js";
import { isUid } from "./schemas";
import { t } from "../i18n";

export type AttachmentRecordPackage = EPackage<"Attachment">;

export function attachmentsCollection(): CollectionReference<AttachmentRecordPackage> {
	return collection<AttachmentRecordPackage>(db, "attachments");
}

function attachmentRef(
	uid: UID,
	attachment: Attachment
): DocumentReference<AttachmentRecordPackage> {
	return doc<AttachmentRecordPackage>(db, "attachments", attachment.id);
}

function attachmentStorageRef(file: Attachment): StorageReference {
	const storagePath = file.storagePath;

	// For some reason, String.prototype.match does not work for this
	const parts =
		Array.from(storagePath.matchAll(/users\/([\w\d]+)\/attachments\/([\w\d]+)\.json/gu))[0] ?? [];
	const errMsg = t("error.storage.invalid-ref-path", { values: { path: storagePath } });

	const uid = parts[1];
	const fileName = parts[2];
	if (!isUid(uid)) throw new TypeError(errMsg);
	if (fileName === undefined) throw new TypeError(errMsg);
	const docRef = attachmentRef(uid, file);
	return ref(db, uid, docRef, fileName);
}

export async function embeddableDataForFile(dek: HashStore, file: Attachment): Promise<string> {
	const storageRef = attachmentStorageRef(file);
	const encryptedData = await downloadString(storageRef);
	if (encryptedData === null) throw new EvalError(t("error.storage.no-data-found"));
	const pkg = JSON.parse(encryptedData) as { ciphertext: string };
	if (!("ciphertext" in pkg)) {
		throw new TypeError(t("error.storage.malformed-payload"));
	}

	const imageData = await decrypt(pkg, dek);
	if (typeof imageData !== "string") {
		throw new TypeError(t("error.fs.expected-string", { values: { type: typeof imageData } }));
	}
	return imageData;
}

export async function attachmentFromSnapshot(
	doc: QueryDocumentSnapshot<AttachmentRecordPackage>,
	dek: HashStore
): Promise<Attachment> {
	const { id, record } = await recordFromSnapshot(doc, dek, isAttachmentRecord);
	return attachment({
		id,
		createdAt: record.createdAt,
		notes: record.notes,
		storagePath: record.storagePath,
		title: record.title,
		type: record.type,
	});
}

export async function createAttachment(
	uid: UID,
	file: File,
	record: Omit<AttachmentRecordParams, "storagePath">,
	dek: HashStore
): Promise<Attachment> {
	const imageData = await dataUrlFromFile(file);
	const fileToUpload = JSON.stringify(await encrypt(imageData, "ImageData", dek));

	const docRef = doc(attachmentsCollection()); // generates unique document ID
	const storageName = doc(attachmentsCollection()); // generates unique file name

	const storageRef = ref(docRef.db, uid, docRef, storageName.id);
	await uploadString(storageRef, fileToUpload); // Store the attachment

	const recordToSave: AttachmentRecordParams = {
		createdAt: record.createdAt,
		notes: record.notes,
		storagePath: `users/${uid}/attachments/${storageName.id}.json`,
		title: record.title,
		type: record.type,
	};
	const pkg = await encrypt(recordToSave, "Attachment", dek);
	await setDoc(docRef, pkg); // Save the record

	return attachment({
		id: docRef.id,
		createdAt: recordToSave.createdAt,
		notes: recordToSave.notes,
		storagePath: recordToSave.storagePath,
		title: recordToSave.title,
		type: recordToSave.type,
	});
}

export async function updateAttachment(
	uid: UID,
	file: File | null,
	attachment: Attachment,
	dek: HashStore
): Promise<void> {
	const record = recordFromAttachment(attachment);
	const pkg = await encrypt(record, "Attachment", dek);
	await setDoc(attachmentRef(uid, attachment), pkg);

	if (file) {
		// delete the old file
		const storageRef = attachmentStorageRef(attachment);
		await deleteObject(storageRef);

		// store the new file
		const imageData = await dataUrlFromFile(file);
		const fileToUpload = JSON.stringify(await encrypt(imageData, "ImageData", dek));

		await uploadString(storageRef, fileToUpload);
	}
}

export async function deleteAttachment(
	uid: UID,
	attachment: Attachment,
	batch?: WriteBatch
): Promise<void> {
	// Delete the storage blob
	const storageRef = attachmentStorageRef(attachment);
	await deleteObject(storageRef);

	// Delete the metadata entry
	const ref = attachmentRef(uid, attachment);
	if (batch) {
		batch.delete(ref);
	} else {
		await deleteDoc(ref);
	}
}
