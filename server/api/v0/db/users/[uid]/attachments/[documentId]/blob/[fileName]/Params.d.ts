import type { UID } from "../../../../../../../../../database/schemas";

export interface Params {
	uid: UID;
	documentId: string;
	fileName: string;
}
