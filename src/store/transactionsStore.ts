import type { Account } from "../model/Account";
import type { Dinero } from "dinero.js";
import type { Location } from "../model/Location";
import type { Month } from "../helpers/monthForTransaction";
import type { Transaction, TransactionRecordParams } from "../model/Transaction";
import type { TransactionRecordPackage, Unsubscribe, WriteBatch } from "../transport";
import type { TransactionSchema } from "../model/DatabaseSchema";
import type { Tag } from "../model/Tag";
import { add, subtract } from "dinero.js";
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
	getTransactionsForAccount as _getTransactionsForAccount,
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

// Account.id -> Transaction.id -> Transaction
const [transactionsForAccount, _transactionsForAccount] = moduleWritable<
	Record<string, Record<string, Transaction>>
>({});
export { transactionsForAccount };

function updateTransactionsForAccount(
	accountId: string,
	transactions: Record<string, Transaction>
): void {
	_transactionsForAccount.update(transactionsForAccount => {
		const copy = { ...transactionsForAccount };
		copy[accountId] = transactions;
		return copy;
	});
}

// Account.id -> Dinero
const [currentBalance, _currentBalance] = moduleWritable<Record<string, Dinero<number>>>({});
export { currentBalance };

function updateBalanceForAccount(accountId: string, newBalance: Dinero<number>): void {
	_currentBalance.update(currentBalance => {
		const copy = { ...currentBalance };
		copy[accountId] = newBalance;
		return copy;
	});
}

function forgetBalanceForAccount(accountId: string): void {
	_currentBalance.update(currentBalance => {
		const copy = { ...currentBalance };
		delete copy[accountId];
		return copy;
	});
}

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

// Transaction.id -> Unsubscribe
let transactionsWatchers: Record<string, Unsubscribe> = {};

// FIXME: Does not care about accounts
export const allTransactions = derived(transactionsForAccount, $transactionsForAccount => {
	const result: Record<string, Transaction> = {};

	for (const transactions of Object.values($transactionsForAccount)) {
		for (const transaction of Object.values(transactions)) {
			result[transaction.id] ??= transaction;
		}
	}

	return Object.values(result);
});

// List of all of the months we care about
export const months = derived(allTransactions, $allTransactions => {
	const result: Record<string, Month> = {};

	for (const transaction of $allTransactions) {
		const monthId = monthIdForTransaction(transaction);
		result[monthId] ??= monthForTransaction(transaction);
	}

	return result;
});

// FIXME: Does not care about accounts
const sortedTransactions = derived(allTransactions, $allTransactions => {
	return $allTransactions //
		.slice()
		.sort(chronologically);
});

export const allBalances = derived(sortedTransactions, $sortedTransactions => {
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
	Object.values(transactionsWatchers).forEach(unsubscribe => unsubscribe());
	transactionsWatchers = {};
	_transactionsForAccount.set({});
	_currentBalance.set({});
	_isLoadingTransactions.set(true);
	logger.debug("transactionsStore: cache cleared");
}

export async function watchTransactions(account: Account, force: boolean = false): Promise<void> {
	// TODO: Watch all accounts at once, so we don't have to decrypt every transaction each time we switch account views
	const accountId = account.id;

	// Clear the known balance, the watcher will set it right
	forgetBalanceForAccount(accountId);

	// Get decryption key ready
	const key = get(pKey);
	if (key === null) throw new Error(t("error.cryption.missing-pek"));
	const { dekMaterial } = await getDekMaterial();
	const dek = await deriveDEK(key, dekMaterial);

	const watcher = transactionsWatchers[accountId];
	if (watcher) {
		watcher();
		delete transactionsWatchers[accountId];

		if (!force) return;
	}

	// Watch the collection
	transactionsWatchers[accountId] = watchAllRecords(
		transactionsCollection(),
		async snap => {
			_isLoadingTransactions.set(true);

			// Update cache (transaction list and balances)
			const changes = snap.docChanges();
			logger.debug(`${changes.length} changed transactions`);
			const accountTransactions = get(transactionsForAccount)[accountId] ?? {};
			let balance = get(currentBalance)[accountId] ?? zeroDinero;
			let errorCount = 0;
			for (const change of changes) {
				if (errorCount >= 5) {
					throw new Error(
						"Got 5 or more errors while parsing transactions changes. Stopping transaction listener"
					); // TODO: i18n
				}
				try {
					const transaction = await transactionFromSnapshot(change.doc, dek);
					if (transaction.accountId !== accountId) break; // skip transactions not for this account

					switch (change.type) {
						case "removed":
							// Update the account's balance total
							balance = subtract(balance, accountTransactions[change.doc.id]?.amount ?? zeroDinero);
							// Forget this transaction
							delete accountTransactions[change.doc.id];
							break;

						case "added": {
							// Add this transaction
							accountTransactions[change.doc.id] = transaction;
							// Update the account's balance total
							balance = add(balance, accountTransactions[change.doc.id]?.amount ?? zeroDinero);
							break;
						}

						case "modified": {
							// Remove this account's balance total
							balance = subtract(balance, accountTransactions[change.doc.id]?.amount ?? zeroDinero);
							// Update this transaction
							accountTransactions[change.doc.id] = transaction;
							// Update this account's balance total
							balance = add(balance, accountTransactions[change.doc.id]?.amount ?? zeroDinero);
							break;
						}
					}
				} catch (error) {
					handleError(error);
					errorCount += 1;
				}
			}
			updateBalanceForAccount(accountId, balance);
			updateTransactionsForAccount(accountId, accountTransactions);
			_isLoadingTransactions.set(false);
		},
		error => {
			handleError(error);
			_isLoadingTransactions.set(false);
		}
	);
}

export async function getTransactionsForAccount(account: Account): Promise<void> {
	try {
		_isLoadingTransactions.set(true);
		const key = get(pKey);
		if (key === null) throw new Error(t("error.cryption.missing-pek"));

		const { dekMaterial } = await getDekMaterial();
		const dek = await deriveDEK(key, dekMaterial);
		const transactions = await _getTransactionsForAccount(account, dek);
		const totalBalance: Dinero<number> = Object.values(transactions).reduce(
			(balance, transaction) => {
				return add(balance, transaction.amount);
			},
			zeroDinero
		);

		_transactionsForAccount.update(transactionsForAccount => {
			const copy = { ...transactionsForAccount };
			copy[account.id] = transactions;
			return copy;
		});
		updateBalanceForAccount(account.id, totalBalance);
	} finally {
		_isLoadingTransactions.set(false);
	}
}

export async function getAllTransactions(): Promise<void> {
	for (const account of get(allAccounts)) {
		await getTransactionsForAccount(account);
	}
}

export function tagIsReferenced(tagId: string): boolean {
	for (const transaction of get(allTransactions)) {
		if (transaction.tagIds.includes(tagId)) {
			// This tag is referenced
			return true;
		}
	}

	return false;
}

export function locationIsReferenced(locationId: string): boolean {
	for (const transaction of get(allTransactions)) {
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

	get(allTransactions).forEach(transaction => {
		if (transaction.tagIds.includes(tagId)) {
			count += 1;
		}
	});

	return count;
}

export function numberOfReferencesForLocation(locationId: string | undefined): number {
	if (locationId === undefined) return 0;
	let count = 0;

	get(allTransactions).forEach(transaction => {
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
	for (const transactions of chunk(get(allTransactions), 500)) {
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
	const relevantTransactions = get(allTransactions).filter(t => t.tagIds.includes(tag.id));
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
