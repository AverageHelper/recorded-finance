import type { Location, LocationRecordParams } from "../model/Location";
import type { LocationRecordPackage, Unsubscribe, WriteBatch } from "../transport";
import type { LocationSchema } from "../model/DatabaseSchema";
import { asyncForEach } from "../helpers/asyncForEach";
import { asyncMap } from "../helpers/asyncMap";
import { derived, get } from "svelte/store";
import { getDekMaterial, pKey, uid } from "./authStore";
import { location, recordFromLocation } from "../model/Location";
import { logger } from "../logger";
import { moduleWritable } from "../helpers/moduleWritable";
import { t } from "../i18n";
import { transaction } from "../model/Transaction";
import { updateUserStats } from "./uiStore";
import chunk from "lodash-es/chunk";
import {
	createLocation as _createLocation,
	deriveDEK,
	getDocs,
	updateLocation as _updateLocation,
	deleteLocation as _deleteLocation,
	locationFromSnapshot,
	locationsCollection,
	watchAllRecords,
	writeBatch,
} from "../transport";

// Location.id -> Location
const [locations, _locations] = moduleWritable<Record<string, Location>>({});
export { locations };

const [locationsLoadError, _locationsLoadError] = moduleWritable<Error | null>(null);
export { locationsLoadError };

let locationsWatcher: Unsubscribe | null = null;

export const allLocations = derived(locations, $locations => {
	return Object.values($locations);
});

export function clearLocationsCache(): void {
	if (locationsWatcher) {
		locationsWatcher();
		locationsWatcher = null;
	}
	_locations.set({});
	_locationsLoadError.set(null);
	logger.debug("locationsStore: cache cleared");
}

export async function watchLocations(force: boolean = false): Promise<void> {
	const key = get(pKey);
	if (key === null) throw new Error(t("error.cryption.missing-pek"));
	const { dekMaterial } = await getDekMaterial();
	const dek = await deriveDEK(key, dekMaterial);

	if (locationsWatcher) {
		locationsWatcher();
		locationsWatcher = null;

		if (!force) return;
	}

	const collection = locationsCollection();
	_locationsLoadError.set(null);
	locationsWatcher = watchAllRecords(
		collection,
		async snap =>
			await asyncForEach(snap.docChanges(), async change => {
				switch (change.type) {
					case "removed":
						_locations.update(locations => {
							const copy = { ...locations };
							delete copy[change.doc.id];
							return copy;
						});
						break;

					case "added":
					case "modified": {
						const location = await locationFromSnapshot(change.doc, dek);
						_locations.update(locations => {
							const copy = { ...locations };
							copy[change.doc.id] = location;
							return copy;
						});
						break;
					}
				}
			}),
		error => {
			_locationsLoadError.set(error);
			if (locationsWatcher) locationsWatcher();
			locationsWatcher = null;
			logger.error(error);
		}
	);
}

export async function createLocation(
	record: LocationRecordParams,
	batch?: WriteBatch
): Promise<Location> {
	const userId = get(uid);
	const key = get(pKey);
	if (key === null) throw new Error(t("error.cryption.missing-pek"));
	if (userId === null) throw new Error(t("error.auth.unauthenticated"));

	const { dekMaterial } = await getDekMaterial();
	const dek = await deriveDEK(key, dekMaterial);

	// If the record matches the title and coords of an extant location, return that instead
	const extantLocation = record.coordinate
		? // coordinate matches
		  get(allLocations).find(
				l =>
					record.coordinate?.lat === l.coordinate?.lat &&
					record.coordinate?.lng === l.coordinate?.lng &&
					record.title === l.title
		  )
		: // title matches
		  get(allLocations).find(l => record.title === l.title && record.subtitle === l.subtitle);

	const newLocation = extantLocation ?? (await _createLocation(userId, record, dek, batch));
	if (!batch) await updateUserStats();

	_locations.update(locations => {
		const copy = { ...locations };
		copy[newLocation.id] = newLocation;
		return copy;
	});
	return newLocation;
}

export async function updateLocation(location: Location, batch?: WriteBatch): Promise<void> {
	const userId = get(uid);
	const key = get(pKey);
	if (key === null) throw new Error(t("error.cryption.missing-pek"));
	if (userId === null) throw new Error(t("error.auth.unauthenticated"));

	const { dekMaterial } = await getDekMaterial();
	const dek = await deriveDEK(key, dekMaterial);
	await _updateLocation(location, dek, batch);
	if (!batch) await updateUserStats();
	_locations.update(locations => {
		const copy = { ...locations };
		copy[location.id] = location;
		return copy;
	});
}

export async function deleteAllLocation(): Promise<void> {
	for (const locations of chunk(get(allLocations), 500)) {
		const batch = writeBatch();
		await Promise.all(locations.map(l => deleteLocation(l, batch)));
		await batch.commit();
	}
}

export async function deleteLocation(location: Location, batch?: WriteBatch): Promise<void> {
	// Transaction views should gracefully handle the
	// case where their linked location does not exist

	await _deleteLocation(location, batch);
	_locations.update(locations => {
		const copy = { ...locations };
		delete copy[location.id];
		return copy;
	});
	if (!batch) await updateUserStats();
}

export async function getAllLocations(): Promise<void> {
	const key = get(pKey);
	if (key === null) throw new Error(t("error.cryption.missing-pek"));

	const { dekMaterial } = await getDekMaterial();
	const dek = await deriveDEK(key, dekMaterial);

	const collection = locationsCollection();
	const snap = await getDocs<LocationRecordPackage>(collection);
	const stored = await asyncMap(snap.docs, async doc => await locationFromSnapshot(doc, dek));
	for (const l of stored) {
		_locations.update(locations => {
			const copy = { ...locations };
			copy[l.id] = l;
			return copy;
		});
	}
}

export async function getAllLocationsAsJson(): Promise<Array<LocationSchema>> {
	const key = get(pKey);
	if (key === null) throw new Error(t("error.cryption.missing-pek"));

	const { dekMaterial } = await getDekMaterial();
	const dek = await deriveDEK(key, dekMaterial);

	const collection = locationsCollection();
	const snap = await getDocs<LocationRecordPackage>(collection);
	const stored = await asyncMap(snap.docs, async doc => await locationFromSnapshot(doc, dek));
	return stored.map(t => ({ ...recordFromLocation(t), id: t.id }));
}

export async function importLocation(
	locationToImport: LocationSchema,
	batch?: WriteBatch
): Promise<void> {
	const { allTransactions, updateTransaction } = await import("./transactionsStore");

	const storedLocation = get(locations)[locationToImport.id] ?? null;
	if (storedLocation) {
		// If duplicate, overwrite the one we have
		const newLocation = location({ ...storedLocation, ...locationToImport });
		await updateLocation(newLocation, batch);
	} else {
		// If new, create a new location
		const params: LocationRecordParams = {
			lastUsed: locationToImport.lastUsed,
			coordinate: locationToImport.coordinate ?? null,
			title: locationToImport.title.trim(),
			subtitle: locationToImport.subtitle?.trim() ?? null,
		};
		const newLocation = await createLocation(params, batch);

		// Update transactions with new location ID
		const matchingTransactions = get(allTransactions).filter(
			t => t.locationId === locationToImport.id
		);
		for (const txns of chunk(matchingTransactions, 500)) {
			const uBatch = writeBatch();
			await Promise.all(
				txns.map(t => {
					const newTxn = transaction(t);
					newTxn.locationId = newLocation.id;
					return updateTransaction(newTxn, uBatch);
				})
			);
			await uBatch.commit();
		}

		await updateUserStats();
	}
}

export async function importLocations(data: Array<LocationSchema>): Promise<void> {
	const { getAllTransactions } = await import("./transactionsStore");
	// Assume we've imported all transactions,
	// but don't assume we have them cached yet
	await getAllTransactions();
	await getAllLocations();

	// Only batch 250 at a time, since each import does up to 2 writes
	for (const locations of chunk(data, 250)) {
		const batch = writeBatch();
		await Promise.all(locations.map(l => importLocation(l, batch)));
		await batch.commit();
	}
}
