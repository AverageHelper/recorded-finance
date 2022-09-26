import type { Identifiable } from "./Identifiable";

export interface Model<T extends string> extends Identifiable<string> {
	readonly id: string;
	readonly objectType: T;
}
