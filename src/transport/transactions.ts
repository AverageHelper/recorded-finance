import type { Account } from "../model/Account";
import type { EPackage } from "./cryption";
import type { HashStore } from "./HashStore";
import type { Transaction, TransactionRecordParams } from "../model/Transaction";
import type {
	CollectionReference,
	DocumentReference,
	QueryDocumentSnapshot,
	WriteBatch,
} from "./db";
import { collection, db, doc, recordFromSnapshot, setDoc, deleteDoc, getDocs } from "./db";
import { encrypt } from "./cryption";
import { isTransactionRecord, recordFromTransaction, transaction } from "../model/Transaction";

export type TransactionRecordPackage = EPackage<"Transaction">;

function transactionRef(transaction: Transaction): DocumentReference<TransactionRecordPackage> {
	const id = transaction.id;
	return doc<TransactionRecordPackage>(db, "transactions", id);
}

export function transactionsCollection(): CollectionReference<TransactionRecordPackage> {
	return collection<TransactionRecordPackage>(db, "transactions");
}

export async function transactionFromSnapshot(
	doc: QueryDocumentSnapshot<TransactionRecordPackage>,
	dek: HashStore
): Promise<Transaction> {
	const { id, record } = await recordFromSnapshot(doc, dek, isTransactionRecord);
	return transaction({
		id,
		accountId: record.accountId,
		amount: record.amount,
		attachmentIds: record.attachmentIds.slice(),
		createdAt: record.createdAt,
		isReconciled: record.isReconciled,
		locationId: record.locationId,
		notes: record.notes,
		objectType: "Transaction",
		tagIds: record.tagIds.slice(),
		title: record.title,
	});
}

export async function getTransactionsForAccount(
	account: Account,
	dek: HashStore
): Promise<Record<string, Transaction>> {
	const snap = await getDocs<TransactionRecordPackage>(transactionsCollection());

	const result: Record<string, Transaction> = {};
	for (const doc of snap.docs) {
		const transaction = await transactionFromSnapshot(doc, dek);
		if (transaction.accountId === account.id) {
			result[doc.id] = transaction;
		}
	}
	return result;
}

export async function createTransaction(
	record: TransactionRecordParams,
	dek: HashStore,
	batch?: WriteBatch
): Promise<Transaction> {
	const pkg = await encrypt(record, "Transaction", dek);
	const ref = doc(transactionsCollection());
	if (batch) {
		batch.set(ref, pkg);
	} else {
		await setDoc(ref, pkg);
	}
	return transaction({
		id: ref.id,
		accountId: record.accountId,
		amount: record.amount,
		attachmentIds: record.attachmentIds.slice(),
		createdAt: record.createdAt,
		isReconciled: record.isReconciled,
		locationId: record.locationId,
		notes: record.notes,
		objectType: "Transaction",
		tagIds: record.tagIds.slice(),
		title: record.title,
	});
}

export async function updateTransaction(
	transaction: Transaction,
	dek: HashStore,
	batch?: WriteBatch
): Promise<void> {
	const record = recordFromTransaction(transaction);
	const pkg = await encrypt(record, "Transaction", dek);
	const ref = transactionRef(transaction);
	if (batch) {
		batch.set(ref, pkg);
	} else {
		await setDoc(ref, pkg);
	}
}

export async function deleteTransaction(
	transaction: Transaction,
	batch?: WriteBatch
): Promise<void> {
	const ref = transactionRef(transaction);
	if (batch) {
		batch.delete(ref);
	} else {
		await deleteDoc(ref);
	}
}
