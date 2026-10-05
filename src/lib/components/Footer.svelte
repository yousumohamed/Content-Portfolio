<script lang="ts">
	import type { Profile } from '../types';
	import { socialLinks } from '../social';

	let { profile }: { profile: Profile } = $props();
	const links = $derived(socialLinks(profile.links));
</script>

<footer>
	<div class="container inner">
		<div class="left">
			<span class="name">{profile.name}</span>
			{#if profile.email}<a class="email" href="mailto:{profile.email}">{profile.email}</a>{/if}
			<span class="muted">© {new Date().getFullYear()} · All work shown is original.</span>
		</div>
		{#if links.length}
			<ul>
				{#each links as l (l.key)}
					<li><a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a></li>
				{/each}
			</ul>
		{/if}
	</div>
</footer>

<style>
	footer {
		margin-top: 96px;
		border-top: 1px solid var(--line);
	}
	.inner {
		display: flex;
		flex-wrap: wrap;
		gap: 16px 32px;
		justify-content: space-between;
		align-items: center;
		padding-block: 28px 36px;
		font-size: 0.875rem;
	}
	.left {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
	}
	.name {
		font-weight: 600;
	}
	.muted {
		color: var(--muted);
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 20px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	a {
		color: var(--muted);
		transition: color 0.15s;
	}
	a:hover {
		color: var(--ink);
	}
	.email {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--line-strong);
		text-underline-offset: 3px;
	}
</style>
