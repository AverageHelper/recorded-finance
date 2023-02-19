<script lang="ts">
	import { _ } from "./i18n";
	import { repoFile, repoMain } from "./platformMeta";
	import AppVersion from "./components/AppVersion.svelte";
	import GitHubIcon from "./icons/GitHub.svelte";
	import I18N from "./components/I18N.svelte";
	import LanguageSelector from "./components/LanguageSelector.svelte";
	import OutLink from "./components/OutLink.svelte";
</script>

<footer>
	<div>
		<p><AppVersion /></p>
		<p>
			<I18N keypath="footer.license">
				<!-- name -->
				<OutLink to={repoFile("LICENSE")} title={$_("footer.view-license")}
					>{$_("footer.license-name")}</OutLink
				>
			</I18N>
		</p>
	</div>
	<aside>
		<LanguageSelector />
		<OutLink to={repoMain} title={$_("footer.view-source")}>
			<GitHubIcon />
		</OutLink>
	</aside>
</footer>
