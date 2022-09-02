import { t } from "../../i18n";

export class UnexpectedResponseError extends TypeError {
	constructor(message: string) {
		super(t("error.server.unexpected-response", { values: { message } }));
		this.name = "UnexpectedResponseError";
	}
}
