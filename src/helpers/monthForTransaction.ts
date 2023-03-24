import type { Transaction } from "../model/Transaction";

/**
 * A descriptor for a calendar month.
 */
export interface Month {
	/**
	 * The instant at which the month begins.
	 */
	start: Date;

	/**
	 * The month's short identifier.
	 */
	id: string;
}

export function monthIdForTransaction(transaction: Transaction): string {
	return transaction.createdAt.toLocaleDateString("en-US", {
		month: "short",
		year: "numeric",
	});
}

export function startOfMonthForTransaction(transaction: Transaction): Date {
	const creationDate = transaction.createdAt;
	return new Date(creationDate.getFullYear(), creationDate.getMonth());
}

export function monthForTransaction(transaction: Transaction): Month {
	return {
		start: startOfMonthForTransaction(transaction),
		id: monthIdForTransaction(transaction),
	};
}
