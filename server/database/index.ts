import type { AnyData, IdentifiedDataItem } from "./schemas";
import type { CollectionReference, DocumentReference } from "./references";
import type { DocUpdate } from "./write";
import { deleteDbCollection, deleteDbDoc, deleteDbDocs, upsertDbDocs } from "./write";
import { fetchDbCollection, fetchDbDoc, fetchDbDocs } from "./read";
import { logger } from "@/logger";
import { publishWriteForRef } from "@/auth/pubnub";

// Since all data is encrypted on the client, we only
// need to bother about persistent I/O. We leave path-
// level access guards to the API endpoints.

export type Unsubscribe = () => void;

type SDataChangeCallback = (newData: Readonly<IdentifiedDataItem> | null) => void;
type PDataChangeCallback = (newData: ReadonlyArray<Readonly<IdentifiedDataItem>>) => void;

interface _Watcher {
	plurality: "single" | "plural";
	id: string;
	onChange: SDataChangeCallback | PDataChangeCallback;
}

interface DocumentWatcher extends _Watcher {
	plurality: "single";
	collectionId: string;
	onChange: SDataChangeCallback;
}

interface CollectionWatcher extends _Watcher {
	plurality: "plural";
	onChange: PDataChangeCallback;
}

const documentWatchers = new Map<string, DocumentWatcher>();
const collectionWatchers = new Map<string, CollectionWatcher>();

export function watchUpdatesToDocument(
	ref: DocumentReference,
	onChange: SDataChangeCallback
): Unsubscribe {
	logger.debug(`Watching updates to document at ${ref.path}`);
	const handle: DocumentWatcher = {
		id: ref.id,
		collectionId: ref.parent.id,
		onChange,
		plurality: "single",
	};
	documentWatchers.set(handle.id, handle);

	// Send all data at path
	/* eslint-disable promise/prefer-await-to-then */
	void fetchDbDoc(ref)
		.then(async ({ ref, data }) => {
			if (data) {
				await informWatchersForDocument(ref, data);
			}
		})
		.catch((error: unknown) => {
			logger.error(`Error on initial data load from document watcher at path ${ref.path}:`, error);
			logger.debug(
				`Removing listener '${handle.id}' for document ${ref.path} due to error on initial load`
			);
			documentWatchers.delete(handle.id);
		});
	/* eslint-enable promise/prefer-await-to-then */

	return (): void => {
		logger.debug(`Removing listener '${handle.id}' for document ${ref.path}`);
		documentWatchers.delete(handle.id);
	};
}

export function watchUpdatesToCollection(
	ref: CollectionReference,
	onChange: PDataChangeCallback
): Unsubscribe {
	const handle: CollectionWatcher = { id: ref.id, onChange, plurality: "plural" };
	collectionWatchers.set(handle.id, handle);

	// Send "added" for all data at path
	/* eslint-disable promise/prefer-await-to-then */
	void fetchDbCollection(ref)
		.then(async data => {
			await informWatchersForCollection(ref, data);
		})
		.catch((error: unknown) => {
			logger.error(
				`Error on initial data load from collection watcher at path ${ref.path}:`,
				error
			);
			logger.debug(
				`Removing listener '${handle.id}' for collection ${ref.path} due to error on initial load`
			);
			collectionWatchers.delete(handle.id);
		});
	/* eslint-enable promise/prefer-await-to-then */

	return (): void => {
		logger.debug(`Removing listener '${handle.id}' for collection ${ref.path}`);
		collectionWatchers.delete(handle.id);
	};
}

async function informWatchersForDocument(
	ref: DocumentReference,
	newItem: Readonly<IdentifiedDataItem> | null
): Promise<void> {
	const docListeners = Array.from(documentWatchers.values()).filter(
		w => w.id === ref.id && w.collectionId === ref.parent.id
	);
	const collectionListeners = Array.from(collectionWatchers.values()) //
		.filter(w => w.id === ref.parent.id);

	if (docListeners.length + collectionListeners.length > 0) {
		logger.debug(
			`Informing ${
				docListeners.length + collectionListeners.length
			} listener(s) about changes to document ${ref.path}`
		);
	}
	await Promise.all(docListeners.map(l => l.onChange(newItem)));
	await publishWriteForRef(ref, newItem);
	const newCollection = await fetchDbCollection(ref.parent);
	await Promise.all(collectionListeners.map(l => l.onChange(newCollection)));
	await publishWriteForRef(ref.parent, newCollection);
}

async function informWatchersForCollection(
	ref: CollectionReference,
	newItems: ReadonlyArray<IdentifiedDataItem>
): Promise<void> {
	const listeners = Array.from(collectionWatchers.values()) //
		.filter(w => w.id === ref.id);

	if (listeners.length > 0) {
		logger.debug(
			`Informing ${listeners.length} listener(s) about changes to collection ${ref.path}`
		);
	}
	await Promise.all(listeners.map(l => l.onChange(newItems)));
	await publishWriteForRef(ref, newItems);
}

export async function deleteDocuments(
	refs: ReadonlyNonEmptyArray<DocumentReference>
): Promise<void> {
	// Fetch the data
	const before = await fetchDbDocs(refs);

	// Delete the stored data
	await deleteDbDocs(refs);

	// Tell listeners what happened
	for (const { ref, data } of before) {
		// Only call listeners about deletion if it wasn't gone in the first place
		if (!data) continue;
		await informWatchersForDocument(ref, null);
	}
}

export async function deleteDocument(ref: DocumentReference): Promise<void> {
	// Fetch the data
	const { data: oldData } = await fetchDbDoc(ref);

	// Delete the stored data
	await deleteDbDoc(ref);

	// Tell listeners what happened
	if (oldData) {
		// Only call listeners about deletion if it wasn't gone in the first place
		await informWatchersForDocument(ref, null);
	}
}

export async function deleteCollection(ref: CollectionReference): Promise<void> {
	await deleteDbCollection(ref);

	// Tell listeners what happened
	await informWatchersForCollection(ref, []);
}

export async function setDocuments(updates: ReadonlyNonEmptyArray<DocUpdate>): Promise<void> {
	await upsertDbDocs(updates);

	// Tell listeners what happened
	// TODO: Do we need to read a "before" value for these too?
	for (const { ref, data } of updates) {
		await informWatchersForDocument(ref, { ...data, _id: ref.id });
	}
}

export async function setDocument(ref: DocumentReference, data: AnyData): Promise<void> {
	await setDocuments([{ ref, data }]);
}

export * from "./references";
export * from "./schemas";

export { fetchDbDoc as getDocument };
export { fetchDbCollection as getCollection };
