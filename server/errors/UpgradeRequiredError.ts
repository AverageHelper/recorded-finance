import { HttpStatusCode } from "../helpers/HttpStatusCode";
import { InternalError } from "./InternalError";

export class UpgradeRequiredError extends InternalError {
	constructor(message: string = "Expected websocket") {
		super({ status: HttpStatusCode.UPGRADE_REQUIRED, code: "unknown", message, harmless: true });
		this.name = "UpgradeRequiredError";
	}
}
