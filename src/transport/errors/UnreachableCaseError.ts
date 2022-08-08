import { t } from "../../i18n";

export class UnreachableCaseError extends Error {
	constructor(value: never) {
		super(t("error.sanity.unreachable-case", { values: { value: JSON.stringify(value) } }));
		this.name = "UnreachableCaseError";
	}
}
