import type { Account } from "../model/Account";
import type { Dinero } from "dinero.js";
import type { Location } from "../model/Location";
import type { Month } from "../helpers/monthForTransaction";
import type { Transaction, TransactionRecordParams } from "../model/Transaction";
import type { TransactionRecordPackage, Unsubscribe, WriteBatch } from "../transport";
import type { TransactionSchema } from "../model/DatabaseSchema";
import type { Tag } from "../model/Tag";
import { add } from "dinero.js";
import { allAccounts } from "./accountsStore";
import { asyncMap } from "../helpers/asyncMap";
import { chronologically, reverseChronologically } from "../model/utility/sort";
import { derived, get } from "svelte/store";
import { getDekMaterial, pKey } from "./authStore";
import { handleError, updateUserStats } from "./uiStore";
import { moduleWritable } from "../helpers/moduleWritable";
import { monthIdForTransaction, monthForTransaction } from "../helpers/monthForTransaction";
import { logger } from "../logger";
import { t } from "../i18n";
import { zeroDinero } from "../helpers/dineroHelpers";
import chunk from "lodash-es/chunk";
import groupBy from "lodash-es/groupBy";
import {
	recordFromTransaction,
	removeAttachmentIdFromTransaction,
	removeTagFromTransaction as _removeTagFromTransaction,
	transaction,
} from "../model/Transaction";
import {
	getAllTransactions,
	createTransaction as _createTransaction,
	deriveDEK,
	getDocs,
	updateTransaction as _updateTransaction,
	deleteTransaction as _deleteTransaction,
	transactionFromSnapshot,
	transactionsCollection,
	watchAllRecords,
	writeBatch,
} from "../transport";

const [isLoadingTransactions, _isLoadingTransactions] = moduleWritable(true);
export { isLoadingTransactions };

const [allTransactionsInAllAccounts, _allTransactionsInAllAccounts] = //
	moduleWritable<ReadonlyArray<Transaction>>([]);
export { allTransactionsInAllAccounts as allTransactions };

// Account.id -> Transaction.id -> Transaction
export const transactionsForAccount = derived(
	allTransactionsInAllAccounts,
	$allTransactionsInAllAccounts => {
		const result: Record<string, Record<string, Transaction>> = {};

		for (const transaction of $allTransactionsInAllAccounts) {
			const group = result[transaction.accountId] ?? {};
			group[transaction.id] ??= transaction;
			result[transaction.accountId] = group;
		}

		return result;
	}
);

// Account.id -> Dinero
export const currentBalance = derived(transactionsForAccount, $transactionsForAccount => {
	const result: Record<string, Dinero<number>> = {};

	// Calc the balance for each account
	for (const [accountId, transactions] of Object.entries($transactionsForAccount)) {
		let balance = zeroDinero;

		for (const transaction of Object.values(transactions)) {
			balance = add(balance, transaction.amount);
		}

		result[accountId] = balance;
	}

	return result;
});

// Account.id -> month -> Transaction[]
export const transactionsForAccountByMonth = derived(
	transactionsForAccount,
	$transactionsForAccount => {
		const result: Record<string, Record<string, Array<Transaction>>> = {};

		for (const accountId of Object.keys($transactionsForAccount)) {
			const transactions = $transactionsForAccount[accountId] ?? {};
			const groupedTransactions = groupBy(transactions, monthIdForTransaction);

			// Sort each transaction list
			for (const month of Object.keys(groupedTransactions)) {
				groupedTransactions[month]?.sort(reverseChronologically);
			}
			result[accountId] = groupedTransactions;
		}

		return result;
	}
);

let transactionsWatcher: Unsubscribe | null = null;

// List of all of the months we care about
export const months = derived(allTransactionsInAllAccounts, $allTransactionsInAllAccounts => {
	const result: Record<string, Month> = {};

	for (const transaction of $allTransactionsInAllAccounts) {
		const monthId = monthIdForTransaction(transaction);
		result[monthId] ??= monthForTransaction(transaction);
	}

	return result;
});

const sortedTransactionsInAllAccounts = derived(
	allTransactionsInAllAccounts,
	$allTransactionsInAllAccounts => {
		return $allTransactionsInAllAccounts //
			.slice()
			.sort(chronologically);
	}
);

export const allBalances = derived(sortedTransactionsInAllAccounts, $sortedTransactions => {
	const balancesByAccount: Record<string, Record<string, Dinero<number>>> = {};

	// Consider each account...
	for (const accountId of get(allAccounts).map(a => a.id)) {
		const balances: Record<string, Dinero<number>> = {}; // Txn.id -> amount

		// Go through each transaction once, counting the account's balance as we go...
		let previous: Transaction | null = null;
		for (const transaction of $sortedTransactions.filter(t => t.accountId === accountId)) {
			const amount = transaction.amount;
			const previousBalance = previous ? balances[previous.id] ?? zeroDinero : zeroDinero;

			// balance so far == current + previous balance so far
			balances[transaction.id] = add(amount, previousBalance);
			previous = transaction;
		}

		balancesByAccount[accountId] = balances;
	}
	return balancesByAccount;
});

export function clearTransactionsCache(): void {
	if (transactionsWatcher) transactionsWatcher();
	transactionsWatcher = null;
	_allTransactionsInAllAccounts.set([]);
	_isLoadingTransactions.set(true);
	logger.debug("transactionsStore: cache cleared");
}

export async function watchTransactions(force: boolean = false): Promise<void> {
	// Get decryption key ready
	const key = get(pKey);
	if (key === null) throw new Error(t("error.cryption.missing-pek"));
	const { dekMaterial } = await getDekMaterial();
	const dek = await deriveDEK(key, dekMaterial);

	if (transactionsWatcher) {
		transactionsWatcher();
		transactionsWatcher = null;

		if (!force) return;
	}

	// Watch the collection
	transactionsWatcher = watchAllRecords(
		transactionsCollection(),
		async snap => {
			_isLoadingTransactions.set(true);
			const transactions = await asyncMap(snap.docs, async doc => {
				return await transactionFromSnapshot(doc, dek);
			});
			_allTransactionsInAllAccounts.set(transactions);
			_isLoadingTransactions.set(false);
		},
		error => {
			handleError(error);
			_isLoadingTransactions.set(false);
		}
	);
}

export async function fetchAllTransactions(): Promise<void> {
	try {
		_isLoadingTransactions.set(true);
		const key = get(pKey);
		if (key === null) throw new Error(t("error.cryption.missing-pek"));

		const { dekMaterial } = await getDekMaterial();
		const dek = await deriveDEK(key, dekMaterial);
		const transactions = await getAllTransactions(dek);
		_allTransactionsInAllAccounts.set(Object.values(transactions));
	} finally {
		_isLoadingTransactions.set(false);
	}
}

export function tagIsReferenced(tagId: string): boolean {
	for (const transaction of get(allTransactionsInAllAccounts)) {
		if (transaction.tagIds.includes(tagId)) {
			// This tag is referenced
			return true;
		}
	}

	return false;
}

export function locationIsReferenced(locationId: string): boolean {
	for (const transaction of get(allTransactionsInAllAccounts)) {
		if (transaction.locationId === locationId) {
			// This location is referenced
			return true;
		}
	}

	return false;
}

export function numberOfReferencesForTag(tagId: string | undefined): number {
	if (tagId === undefined) return 0;
	let count = 0;

	get(allTransactionsInAllAccounts).forEach(transaction => {
		if (transaction.tagIds.includes(tagId)) {
			count += 1;
		}
	});

	return count;
}

export function numberOfReferencesForLocation(locationId: string | undefined): number {
	if (locationId === undefined) return 0;
	let count = 0;

	get(allTransactionsInAllAccounts).forEach(transaction => {
		if (transaction.locationId === locationId) {
			count += 1;
		}
	});

	return count;
}

export async function createTransaction(
	record: TransactionRecordParams,
	batch?: WriteBatch
): Promise<Transaction> {
	const key = get(pKey);
	if (key === null) throw new Error(t("error.cryption.missing-pek"));

	const { dekMaterial } = await getDekMaterial();
	const dek = await deriveDEK(key, dekMaterial);
	const transaction = await _createTransaction(record, dek, batch);
	if (!batch) await updateUserStats();
	return transaction;
}

export async function updateTransaction(
	transaction: Transaction,
	batch?: WriteBatch
): Promise<void> {
	const key = get(pKey);
	if (key === null) throw new Error(t("error.cryption.missing-pek"));

	const { dekMaterial } = await getDekMaterial();
	const dek = await deriveDEK(key, dekMaterial);
	await _updateTransaction(transaction, dek, batch);
	if (!batch) await updateUserStats();
}

export async function deleteTransaction(
	transaction: Transaction,
	batch?: WriteBatch
): Promise<void> {
	await _deleteTransaction(transaction, batch);
	if (!batch) await updateUserStats();
}

export async function deleteAllTransactions(): Promise<void> {
	for (const transactions of chunk(get(allTransactionsInAllAccounts), 500)) {
		const batch = writeBatch();
		await Promise.all(transactions.map(t => deleteTransaction(t, batch)));
		await batch.commit();
	}
}

export async function removeTagFromTransaction(
	tag: Tag,
	transaction: Transaction,
	batch?: WriteBatch
): Promise<void> {
	_removeTagFromTransaction(transaction, tag);
	await updateTransaction(transaction, batch);
}

export async function removeTagFromAllTransactions(tag: Tag): Promise<void> {
	// for each transaction that has this tag, remove the tag
	const relevantTransactions = get(allTransactionsInAllAccounts) //
		.filter(t => t.tagIds.includes(tag.id));
	for (const transactions of chunk(relevantTransactions, 500)) {
		const batch = writeBatch();
		await Promise.all(transactions.map(t => removeTagFromTransaction(tag, t, batch)));
		await batch.commit();
	}
}

export async function removeAttachmentFromTransaction(
	fileId: string,
	transaction: Transaction,
	batch?: WriteBatch
): Promise<void> {
	removeAttachmentIdFromTransaction(transaction, fileId);
	await updateTransaction(transaction, batch);
}

export async function deleteTagIfUnreferenced(tag: Tag, batch?: WriteBatch): Promise<void> {
	if (tagIsReferenced(tag.id)) return;

	// This tag is unreferenced
	const { deleteTag } = await import("./tagsStore");
	await deleteTag(tag, batch);
}

export async function deleteLocationIfUnreferenced(
	location: Location,
	batch?: WriteBatch
): Promise<void> {
	if (locationIsReferenced(location.id)) return;

	// This location is unreferenced
	const { deleteLocation } = await import("./locationsStore");
	await deleteLocation(location, batch);
}

export async function getAllTransactionsAsJson(
	account: Account
): Promise<Array<TransactionSchema>> {
	const key = get(pKey);
	if (key === null) throw new Error(t("error.cryption.missing-pek"));

	const { dekMaterial } = await getDekMaterial();
	const dek = await deriveDEK(key, dekMaterial);

	const collection = transactionsCollection();
	const snap = await getDocs<TransactionRecordPackage>(collection);
	const stored = await asyncMap(snap.docs, async doc => await transactionFromSnapshot(doc, dek));
	return stored
		.filter(transaction => transaction.accountId === account.id)
		.map(t => ({ ...recordFromTransaction(t), id: t.id }));
}

export async function importTransaction(
	transactionToImport: TransactionSchema,
	account: Account,
	batch?: WriteBatch
): Promise<void> {
	const storedTransactions = get(transactionsForAccount)[account.id] ?? {};
	const storedTransaction = storedTransactions[transactionToImport.id] ?? null;
	if (storedTransaction) {
		// If duplicate, overwrite the one we have
		const newTransaction = transaction({
			...storedTransaction,
			...transactionToImport,
			id: storedTransaction.id,
		});
		await updateTransaction(newTransaction, batch);
	} else {
		// If new, create a new transaction
		const params: TransactionRecordParams = {
			createdAt: transactionToImport.createdAt,
			amount: transactionToImport.amount,
			locationId: transactionToImport.locationId ?? null,
			isReconciled: transactionToImport.isReconciled ?? false,
			attachmentIds: transactionToImport.attachmentIds ?? [],
			tagIds: transactionToImport.tagIds ?? [],
			accountId: account.id,
			title: transactionToImport.title?.trim() ?? null,
			notes: transactionToImport.notes?.trim() ?? null,
		};
		await createTransaction(params, batch);
	}
}

export async function importTransactions(
	data: Array<TransactionSchema>,
	account: Account
): Promise<void> {
	for (const transactions of chunk(data, 500)) {
		const batch = writeBatch();
		await Promise.all(transactions.map(t => importTransaction(t, account, batch)));
		await batch.commit();
	}
	await updateUserStats();
}
