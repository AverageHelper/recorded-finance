import type { Account, AccountRecordParams } from "../model/Account";
import type { HashStore } from "../transport";
import type { Unsubscribe } from "firebase/auth";
import { defineStore } from "pinia";
import { useAuthStore } from "./authStore";
import {
	createAccount,
	deriveDEK,
	updateAccount,
	deleteAccount,
	accountFromSnapshot,
	accountsCollection,
	watchAllRecords,
} from "../transport";

export const useAccountsStore = defineStore("accounts", {
	state: () => ({
		items: {} as Dictionary<Account>,
		currentBalance: {} as Dictionary<Account>,
		loadError: null as Error | null,
		accountsWatcher: null as Unsubscribe | null,
	}),
	actions: {
		clearCache() {
			this.items = {};
		},
		watchAccounts(force: boolean = false) {
			if (this.accountsWatcher && !force) return;

			if (this.accountsWatcher) {
				this.accountsWatcher();
				this.accountsWatcher = null;
			}

			const authStore = useAuthStore();
			const uid = authStore.uid;
			const pKey = authStore.pKey as HashStore | null;
			if (pKey === null) throw new Error("No decryption key");
			if (uid === null) throw new Error("Sign in first");

			const collection = accountsCollection(uid);
			this.accountsWatcher = watchAllRecords(
				collection,
				async snap => {
					this.loadError = null;
					const authStore = useAuthStore();
					const { dekMaterial } = await authStore.getDekMaterial();
					const dek = deriveDEK(pKey, dekMaterial);

					snap.docChanges().forEach(change => {
						switch (change.type) {
							case "removed":
								delete this.items[change.doc.id];
								break;

							case "added":
							case "modified":
								this.items[change.doc.id] = accountFromSnapshot(change.doc, dek);
								break;
						}
					});
				},
				error => {
					this.loadError = error;
				}
			);
		},
		async createAccount(record: AccountRecordParams): Promise<Account> {
			const authStore = useAuthStore();
			const uid = authStore.uid;
			const pKey = authStore.pKey as HashStore | null;
			if (pKey === null) throw new Error("No decryption key");
			if (uid === null) throw new Error("Sign in first");

			const { dekMaterial } = await authStore.getDekMaterial();
			const dek = deriveDEK(pKey, dekMaterial);
			return await createAccount(uid, record, dek);
		},
		async updateAccount(account: Account): Promise<void> {
			const authStore = useAuthStore();
			const uid = authStore.uid;
			const pKey = authStore.pKey as HashStore | null;
			if (pKey === null) throw new Error("No decryption key");
			if (uid === null) throw new Error("Sign in first");

			const { dekMaterial } = await authStore.getDekMaterial();
			const dek = deriveDEK(pKey, dekMaterial);
			await updateAccount(uid, account, dek);
		},
		async deleteAccount(account: Account): Promise<void> {
			const authStore = useAuthStore();
			const uid = authStore.uid;
			if (uid === null) throw new Error("Sign in first");

			// Don't delete if we have transactions
			const { useTransactionsStore } = await import("./transactionsStore");
			const transactions = useTransactionsStore();
			const accountTransactions = transactions.transactionsForAccount[account.id] ?? {};
			const transactionCount = Object.keys(accountTransactions).length;
			if (transactionCount !== 0) {
				throw new Error("Cannot delete an account that has transactions.");
			}

			await deleteAccount(uid, account);
		},
	},
	getters: {
		balanceForAccount(): (account: Account) => number {
			return (account: Account): number => {
				if (!Object.keys(this.items).includes(account.id)) return 0;

				// Add every transaction together for this account. Fetch them if you have to.
				return 0;
			};
		},
	},
});
