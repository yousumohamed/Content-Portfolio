<script lang="ts">
	import Header from '#lib/components/Header.svelte';
	import Footer from '#lib/components/Footer.svelte';

	let { data, children } = $props();
</script>

<Header profile={data.profile} />

{#if data.setupError}
	<div class="container">
		<div class="setup card-surface">
			<strong>Almost there — the database isn't set up yet.</strong>
			<p>
				Open your Supabase dashboard → SQL Editor, paste the contents of <code>supabase/schema.sql</code> and run it.
				Then reload this page.
			</p>
			<p class="err">{data.setupError}</p>
		</div>
	</div>
{/if}

<main>
	{@render children()}
</main>

<Footer profile={data.profile} />

<style>
	main {
		min-height: 60vh;
	}
	.setup {
		margin-top: 24px;
		padding: 20px 24px;
		display: grid;
		gap: 6px;
		font-size: 0.92rem;
	}
	.setup p {
		color: var(--ink-2);
	}
	.err {
		font-size: 0.8rem;
		color: var(--muted) !important;
		font-family: ui-monospace, monospace;
	}
	code {
		font-family: ui-monospace, monospace;
		font-size: 0.85em;
		padding: 1px 6px;
		border-radius: 4px;
		background: var(--surface-2);
	}
</style>
