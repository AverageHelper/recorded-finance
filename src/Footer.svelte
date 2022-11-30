<script lang="ts">
	import { _ } from "./i18n";
	import { repoFile, repoMain } from "./platformMeta";
	import AppVersion from "./components/AppVersion.svelte";
	import GitHubIcon from "./icons/GitHub.svelte";
	import I18N from "./components/I18N.svelte";
	import OutLink from "./components/OutLink.svelte";
</script>

<footer class="footer-0696aa0e">
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
	<p>
		<OutLink to={repoMain} title={$_("footer.view-source")}>
			<GitHubIcon class="icon" alt={$_("footer.view-github")} title={$_("footer.view-github")} />
		</OutLink>
	</p>
</footer>

<style lang="scss" global>
	@use "styles/colors" as *;

	.footer-0696aa0e {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		flex-flow: row nowrap;
		justify-content: space-between;
		align-items: center;
		margin: 0;
		padding: 8pt 16pt;
		background-color: color($cloud);

		p {
			color: color($secondary-label);
			margin: 0;
		}
	}

	.icon {
		color: color($label);
	}
</style>
