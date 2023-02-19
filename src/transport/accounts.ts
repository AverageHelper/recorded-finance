import type {
	CollectionReference,
	DocumentReference,
	QueryDocumentSnapshot,
	WriteBatch,
} from "./db";
import type { Account, AccountRecordParams } from "../model/Account";
import type { EPackage } from "./cryption";
import type { HashStore } from "./HashStore";
import { account, isAccountRecord, recordFromAccount } from "../model/Account";
import { encrypt } from "./cryption";
import { collection, db, doc, recordFromSnapshot, setDoc, deleteDoc } from "./db";

export type AccountRecordPackage = EPackage<"Account">;

export function accountsCollection(): CollectionReference<AccountRecordPackage> {
	return collection<AccountRecordPackage>(db, "accounts");
}

function accountRef(account: Account): DocumentReference<AccountRecordPackage> {
	return doc<AccountRecordPackage>(db, "accounts", account.id);
}

export async function accountFromSnapshot(
	doc: QueryDocumentSnapshot<AccountRecordPackage>,
	dek: HashStore
): Promise<Account> {
	const { id, record } = await recordFromSnapshot(doc, dek, isAccountRecord);
	return account({
		createdAt: record.createdAt,
		notes: record.notes,
		title: record.title,
		id,
	});
}

export async function createAccount(
	record: AccountRecordParams,
	dek: HashStore,
	batch?: WriteBatch
): Promise<Account> {
	const pkg = await encrypt(record, "Account", dek);
	const ref = doc(accountsCollection());
	if (batch) {
		batch.set(ref, pkg);
	} else {
		await setDoc(ref, pkg);
	}
	return account({
		createdAt: record.createdAt,
		notes: record.notes,
		title: record.title,
		id: ref.id,
	});
}

export async function updateAccount(
	account: Account,
	dek: HashStore,
	batch?: WriteBatch
): Promise<void> {
	const record = recordFromAccount(account);
	const pkg = await encrypt(record, "Account", dek);
	const ref = accountRef(account);
	if (batch) {
		batch.set(ref, pkg);
	} else {
		await setDoc(ref, pkg);
	}
}

export async function deleteAccount(account: Account, batch?: WriteBatch): Promise<void> {
	const ref = accountRef(account);
	if (batch) {
		batch.delete(ref);
	} else {
		await deleteDoc(ref);
	}
}
