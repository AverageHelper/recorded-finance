import type { UID } from "@/database";

export interface Params {
	uid: UID;
	collectionId: string;
	documentId: string;
}
