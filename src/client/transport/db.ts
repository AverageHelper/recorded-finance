import type { FirebaseStorage } from "firebase/storage";
import type {
	CollectionReference,
	DocumentData,
	Firestore,
	FirestoreError,
	QueryDocumentSnapshot,
	QuerySnapshot,
	Unsubscribe,
} from "firebase/firestore";
import type { EPackage, HashStore } from "./cryption";
import { getFirestore, onSnapshot } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeApp } from "firebase/app";
import { decrypt } from "./cryption";
import { forgetJobQueue, useJobQueue } from "@averagehelper/job-queue";

export let db: Firestore;
export let storage: FirebaseStorage;

export function isWrapperInstantiated(): boolean {
	return db !== undefined;
}

/**
 * Bootstrap our Firebase app using either environment variables or provided params.
 *
 * @param params Values to use instead of environment variables to instantiate Firebase.
 */
export function bootstrap(params?: {
	apiKey?: string;
	authDomain?: string;
	projectId?: string;
}): void {
	if (isWrapperInstantiated()) {
		throw new TypeError("db has already been instantiated");
	}

	// VITE_ env variables get type definitions in env.d.ts
	const apiKey = params?.apiKey ?? import.meta.env.VITE_FIREBASE_API_KEY;
	const authDomain = params?.authDomain ?? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
	const projectId = params?.projectId ?? import.meta.env.VITE_FIREBASE_PROJECT_ID;

	if (apiKey === undefined || !apiKey) {
		throw new TypeError("No value found for environment variable VITE_FIREBASE_API_KEY");
	}
	if (authDomain === undefined || !authDomain) {
		throw new TypeError("No value found for environment variable VITE_FIREBASE_AUTH_DOMAIN");
	}
	if (projectId === undefined || !projectId) {
		throw new TypeError("No value found for environment variable VITE_FIREBASE_PROJECT_ID");
	}

	const firebaseApp = initializeApp({ apiKey, authDomain, projectId });
	db = getFirestore(firebaseApp);
	storage = getStorage(firebaseApp);
}

export function watchAllRecords<T = DocumentData>(
	collection: CollectionReference<T>,
	onSnap: (snap: QuerySnapshot<T>) => void | Promise<void>,
	onError?: ((error: FirestoreError) => void) | undefined,
	onCompletion?: (() => void) | undefined
): Unsubscribe {
	const queueId = `watchAllRecords-${collection.path}`;
	const queue = useJobQueue<QuerySnapshot<T>>(queueId);
	queue.process(onSnap);
	const unsubscribe = onSnapshot(collection, snap => queue.createJob(snap), onError, onCompletion);

	return (): void => {
		unsubscribe();
		forgetJobQueue(queueId);
	};
}

type TypeGuard<G> = (toBeDetermined: unknown) => toBeDetermined is G;

export function recordFromSnapshot<G>(
	doc: QueryDocumentSnapshot<EPackage<unknown>>,
	dek: HashStore,
	typeGuard: TypeGuard<G>
): { id: string; record: G } {
	const pkg = doc.data();
	const record = decrypt(pkg, dek);
	if (!typeGuard(record)) {
		throw new TypeError(`Failed to parse record from Firestore document ${doc.id}`);
	}
	return { id: doc.id, record };
}