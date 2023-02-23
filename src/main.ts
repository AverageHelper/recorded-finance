import "./polyfills";
import App from "./App.svelte";
import { logger } from "./logger";

// Remove the fallback element. This won't happen if JS is disabled.
document.querySelector("#noscript")?.remove();

// Initialize Svelte app
new App({
	target: document.body,
});

// Warn people in the console about console stuff
logger.info("%c// CAUTION //", "color: red; font-size: x-large");
logger.info(
	"%cIf someone told you to copy/paste something here, you're probably being scammed.",
	"font-size: x-large"
);
logger.info(
	"%cPasting anything in here could give attackers access to your account.",
	"color: red; font-size: x-large"
);

// TODO: Get CSRF value from server, much like version
