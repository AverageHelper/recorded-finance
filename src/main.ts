import App from "./App.svelte";

// Remove the fallback element. This won't happen if JS is disabled.
document.querySelector("#noscript")?.remove();

// Initialize Svelte app
new App({
	target: document.body,
});
