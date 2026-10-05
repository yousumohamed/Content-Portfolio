<script lang="ts">
	import { page } from '$app/state';
	import { Search, X } from '@lucide/svelte';
	import type { Profile } from '../types';
	import { publicUrl } from '../media';
	import ThemeToggle from './ThemeToggle.svelte';

	let { profile }: { profile: Profile } = $props();

	let searchOpen = $state(false);
	let input = $state<HTMLInputElement>();
	const q = $derived(page.url.searchParams.get('q') ?? '');
	const initials = $derived(
		profile.name
			.split(/\s+/)
			.map((w) => w[0])
			.join('')
			.slice(0, 2)
			.toUpperCase()
	);

	function openSearch() {
		searchOpen = true;
		queueMicrotask(() => input?.focus());
	}
</script>

<header class="site-header">
	<div class="container inner" class:searching={searchOpen}>
		<a href="/" class="brand" aria-label="{profile.name} — home">
			{#if profile.avatar_path}
				<img src={publicUrl(profile.avatar_path)} alt="" width="30" height="30" />
			{:else}
				<span class="mono">{initials}</span>
			{/if}
			<span class="name">{profile.name}</span>
		</a>

		<form class="search" action="/" method="GET" role="search">
			<Search size={17} strokeWidth={2} aria-hidden="true" />
			<label class="sr-only" for="site-search">Search work</label>
			<input
				id="site-search"
				bind:this={input}
				name="q"
				type="search"
				placeholder="Search work"
				value={q}
				autocomplete="off"
				onblur={() => (searchOpen = false)}
			/>
		</form>

		<nav aria-label="Primary">
			<button class="btn btn-ghost btn-icon btn-sm search-toggle" onclick={openSearch} aria-label="Search">
				<Search size={18} />
			</button>
			<a href="/" class="nav-link" aria-current={page.url.pathname === '/' ? 'page' : undefined}>Work</a>
			<a href="/about" class="nav-link" aria-current={page.url.pathname === '/about' ? 'page' : undefined}>About</a>
			<ThemeToggle />
			{#if profile.email}
				<a class="btn btn-primary btn-sm contact" href="mailto:{profile.email}">Get in touch</a>
			{/if}
		</nav>

		{#if searchOpen}
			<button
				class="btn btn-ghost btn-icon btn-sm close-search"
				aria-label="Close search"
				onmousedown={() => (searchOpen = false)}
			>
				<X size={18} />
			</button>
		{/if}
	</div>
</header>

<style>
	.site-header {
		position: sticky;
		top: 0;
		z-index: 40;
		height: var(--header-h);
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		backdrop-filter: saturate(1.4) blur(14px);
		-webkit-backdrop-filter: saturate(1.4) blur(14px);
	}
	.inner {
		height: 100%;
		display: grid;
		grid-template-columns: 1fr minmax(0, 520px) 1fr;
		align-items: center;
		gap: 20px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
		font-size: 1rem;
		letter-spacing: -0.02em;
		min-width: 0;
		justify-self: start;
	}
	.brand img,
	.mono {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		object-fit: cover;
		flex: none;
	}
	.mono {
		display: grid;
		place-items: center;
		background: var(--ink);
		color: var(--bg);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}
	.name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.search {
		position: relative;
		display: flex;
		align-items: center;
		color: var(--muted);
	}
	.search :global(svg) {
		position: absolute;
		left: 14px;
		pointer-events: none;
	}
	.search input {
		width: 100%;
		height: 40px;
		padding: 0 16px 0 40px;
		border-radius: 999px;
		border: 1px solid transparent;
		background: var(--surface-2);
		color: var(--ink);
		font-size: 0.9rem;
		transition:
			background 0.15s,
			border-color 0.15s;
	}
	.search input::placeholder {
		color: var(--muted);
	}
	.search input:hover {
		border-color: var(--line);
	}
	.search input:focus {
		outline: none;
		background: var(--surface);
		border-color: var(--ink);
	}
	nav {
		display: flex;
		align-items: center;
		gap: 4px;
		justify-self: end;
	}
	.nav-link {
		padding: 8px 12px;
		border-radius: 999px;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--muted);
		transition: color 0.15s;
	}
	.nav-link:hover,
	.nav-link[aria-current='page'] {
		color: var(--ink);
	}
	.contact {
		margin-left: 8px;
	}
	.search-toggle,
	.close-search {
		display: none;
	}

	@media (max-width: 760px) {
		.inner {
			grid-template-columns: 1fr auto;
		}
		.search {
			display: none;
		}
		.search-toggle {
			display: inline-flex;
		}
		.contact {
			display: none;
		}
		.searching .brand,
		.searching nav {
			display: none;
		}
		.searching .search {
			display: flex;
		}
		.searching .close-search {
			display: inline-flex;
		}
	}
</style>
