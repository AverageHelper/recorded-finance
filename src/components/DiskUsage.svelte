<script lang="ts">
	import { _, locale } from "../i18n";
	import { simplifiedByteCount } from "../transformers";
	import { totalSpace, usedSpace } from "../store";

	$: total = $totalSpace !== null ? simplifiedByteCount($locale.code, $totalSpace) : "--";
	$: used = $usedSpace !== null ? simplifiedByteCount($locale.code, $usedSpace) : "--";
</script>

<p class="storage">{$_("common.disk-usage", { values: { used, total } })}</p>

<style lang="scss">
	@use "styles/colors" as *;

	.storage {
		margin: 8pt auto;
		color: color($secondary-label);
	}
</style>
