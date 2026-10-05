<script lang="ts">
	import { goto, preloadData, pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { LoaderCircle, MapPin, X } from '@lucide/svelte';
	import MasonryGrid from '#lib/components/MasonryGrid.svelte';
	import PostCard from '#lib/components/PostCard.svelte';
	import PostView from '#lib/components/PostView.svelte';
	import Overlay from '#lib/components/Overlay.svelte';
	import { fetchFeed } from '#lib/feed.ts';
	import { ratioOf, publicUrl } from '#lib/media.ts';
	import { plural } from '#lib/format.ts';
	import { socialLinks } from '#lib/social.ts';
	import type { FeedPost, Post } from '#lib/types.ts';

	let { data } = $props();

	// Overridable deriveds: reset whenever the load function re-runs (filters change).
	let posts: FeedPost[] = $derived(data.posts);
	let hasMore: boolean = $derived(data.hasMore);
	let loadingMore = $state(false);
	let opening = $state<string | null>(null);

	const profile = $derived(data.profile);
	const links = $derived(socialLinks(profile.links));
	const f = $derived(data.filters);
	const searching = $derived(Boolean(f.q || f.tag));

	const TYPES = [
		{ value: null, label: 'All' },
		{ value: 'image', label: 'Photos' },
		{ value: 'video', label: 'Videos' }
	] as const;

	function hrefWith(changes: Record<string, string | null>) {
		const url = new URL(page.url.href);
		for (const [k, v] of Object.entries(changes)) {
			if (v) url.searchParams.set(k, v);
			else url.searchParams.delete(k);
		}
		return url.pathname + url.search;
	}

	function setFilter(changes: Record<string, string | null>) {
		goto(hrefWith(changes), { reset: false });
	}

	async function loadMore() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		const res = await fetchFeed(data.supabase, { ...f, offset: posts.length });
		const seen = new Set(posts.map((p) => p.id));
		posts = [...posts, ...res.posts.filter((p) => !seen.has(p.id))];
		hasMore = res.hasMore;
		loadingMore = false;
	}

	function infinite(node: HTMLElement) {
		const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), {
			rootMargin: '900px 0px'
		});
		io.observe(node);
		return () => io.disconnect();
	}

	/** Open a post in an overlay (shallow routing), Pinterest-style. Falls back to a normal visit. */
	async function openPost(e: MouseEvent, post: FeedPost) {
		if (window.innerWidth < 720) return;
		e.preventDefault();
		const href = `/p/${post.slug}`;
		opening = post.id;
		const result = await preloadData(href);
		opening = null;
		if (result.type === 'loaded' && result.status === 200) {
			const d = result.data as { post: Post; related: FeedPost[] };
			pushState(href, { post: d.post, related: d.related });
		} else {
			goto(href);
		}
	}
</script>

<svelte:head>
	<title>{f.q ? `“${f.q}” — ` : ''}{profile.name}</title>
	<meta name="description" content={profile.headline} />
	<meta property="og:title" content={profile.name} />
	<meta property="og:description" content={profile.headline} />
	{#if posts[0]?.cover_thumb_path}
		<meta property="og:image" content={publicUrl(posts[0].cover_thumb_path)} />
	{/if}
</svelte:head>

{#if !searching}
	<section class="hero container">
		<h1>{profile.name}</h1>
		<div class="hero-row">
			<p class="headline">{profile.headline}</p>
			<dl class="facts">
				{#if profile.location}
					<div><dt class="sr-only">Based in</dt><dd><MapPin size={15} />{profile.location}</dd></div>
				{/if}
				<div><dt class="sr-only">Work</dt><dd>{plural(data.totalPosts, 'project')}</dd></div>
				{#each links.slice(0, 3) as l (l.key)}
					<div>
						<dt class="sr-only">{l.label}</dt>
						<dd><a href={l.href} target="_blank" rel="noopener noreferrer">{l.label} ↗</a></dd>
					</div>
				{/each}
			</dl>
		</div>
	</section>
{:else}
	<section class="results container">
		<p class="eyebrow">{f.tag ? 'Tag' : 'Search'}</p>
		<h1>{f.tag ? `#${f.tag}` : `“${f.q}”`}</h1>
		<a class="btn btn-sm" href="/"><X size={15} />Clear</a>
	</section>
{/if}

<div class="filters">
	<div class="container filters-inner">
		<div class="segmented" role="group" aria-label="Media type">
			{#each TYPES as t (t.label)}
				<button aria-pressed={f.type === t.value} onclick={() => setFilter({ type: t.value })}>{t.label}</button>
			{/each}
		</div>

		{#if data.categories.length}
			<span class="divider" aria-hidden="true"></span>
			<div class="cats" role="group" aria-label="Categories">
				<button class="chip" aria-pressed={!data.activeCategory} onclick={() => setFilter({ c: null })}>Everything</button>
				{#each data.categories as c (c.id)}
					<button
						class="chip"
						aria-pressed={data.activeCategory?.id === c.id}
						onclick={() => setFilter({ c: data.activeCategory?.id === c.id ? null : c.slug })}
					>
						{c.name}
					</button>
				{/each}
			</div>
		{/if}

		<label class="sort">
			<span class="sr-only">Sort</span>
			<select class="select" value={f.sort} onchange={(e) => setFilter({ sort: e.currentTarget.value === 'latest' ? null : e.currentTarget.value })}>
				<option value="latest">Latest</option>
				<option value="popular">Most viewed</option>
				<option value="liked">Most appreciated</option>
			</select>
		</label>
	</div>
</div>

<section class="container feed" aria-label="Work" aria-busy={loadingMore}>
	{#if posts.length}
		<MasonryGrid items={posts} key={(p) => p.id} ratio={(p) => ratioOf(p.cover_width, p.cover_height)}>
			{#snippet children(post, i)}
				<div class="cell" class:opening={opening === post.id}>
					<PostCard {post} eager={i < 8} onopen={openPost} />
				</div>
			{/snippet}
		</MasonryGrid>

		{#if hasMore}
			<div class="more" {@attach infinite}>
				<button class="btn" onclick={loadMore} disabled={loadingMore}>
					{#if loadingMore}<LoaderCircle size={16} class="spin" />Loading{:else}Load more{/if}
				</button>
			</div>
		{/if}
	{:else}
		<div class="empty">
			<div class="empty-art" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
			<h2>{searching || f.type || data.activeCategory ? 'Nothing matches that' : 'No work published yet'}</h2>
			<p>
				{#if searching || f.type || data.activeCategory}
					Try a different filter or search term.
				{:else}
					New projects will appear here as soon as they're published.
				{/if}
			</p>
			{#if searching || f.type || data.activeCategory}
				<a class="btn" href="/">Show everything</a>
			{/if}
		</div>
	{/if}
</section>

{#if page.state.post}
	<Overlay onclose={() => history.back()} href="/p/{page.state.post.slug}" label={page.state.post.title}>
		<PostView
			post={page.state.post}
			related={page.state.related ?? []}
			profile={data.profile}
			supabase={data.supabase}
			inOverlay
		/>
	</Overlay>
{/if}

<style>
	.hero {
		padding-top: clamp(40px, 8vw, 104px);
		padding-bottom: clamp(28px, 4vw, 48px);
	}
	.hero h1 {
		font-size: clamp(2.75rem, 9vw, 7.5rem);
		font-weight: 600;
		letter-spacing: -0.055em;
		line-height: 0.92;
		margin-left: -0.04em;
	}
	.hero-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px 48px;
		margin-top: clamp(20px, 3vw, 32px);
	}
	.headline {
		max-width: 560px;
		font-size: clamp(1.1rem, 1.6vw, 1.35rem);
		line-height: 1.4;
		letter-spacing: -0.015em;
		color: var(--ink-2);
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 22px;
		margin: 0;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.facts dd {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 0;
	}
	.facts a {
		color: var(--ink);
		font-weight: 500;
		transition: opacity 0.15s;
	}
	.facts a:hover {
		opacity: 0.6;
	}

	.results {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: end;
		padding-top: 40px;
		padding-bottom: 24px;
	}
	.results .eyebrow {
		grid-column: 1 / -1;
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--muted);
		margin-bottom: 6px;
	}
	.results h1 {
		font-size: clamp(2rem, 5vw, 3.5rem);
		letter-spacing: -0.04em;
	}

	.filters {
		position: sticky;
		top: var(--header-h);
		z-index: 30;
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		backdrop-filter: saturate(1.4) blur(14px);
		-webkit-backdrop-filter: saturate(1.4) blur(14px);
		border-bottom: 1px solid var(--line);
	}
	.filters-inner {
		display: flex;
		align-items: center;
		gap: 12px;
		height: 60px;
	}
	.segmented {
		display: inline-flex;
		flex: none;
		padding: 3px;
		border-radius: 999px;
		background: var(--surface-2);
	}
	.segmented button {
		height: 30px;
		padding: 0 14px;
		border-radius: 999px;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--muted);
		transition:
			background 0.15s,
			color 0.15s;
	}
	.segmented button:hover {
		color: var(--ink);
	}
	.segmented button[aria-pressed='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: var(--shadow-sm);
	}
	.divider {
		flex: none;
		width: 1px;
		height: 22px;
		background: var(--line);
	}
	.cats {
		display: flex;
		gap: 6px;
		min-width: 0;
		flex: 1;
		overflow-x: auto;
		scrollbar-width: none;
		mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
		padding-right: 24px;
	}
	.cats::-webkit-scrollbar {
		display: none;
	}
	.cats .chip {
		height: 32px;
	}
	.sort {
		flex: none;
		margin-left: auto;
	}
	.sort .select {
		min-height: 34px;
		height: 34px;
		padding-block: 0;
		border-radius: 999px;
		font-size: 0.85rem;
		font-weight: 500;
		background-color: transparent;
	}

	.feed {
		padding-top: 24px;
	}
	.cell {
		transition: opacity 0.2s;
	}
	.cell.opening {
		opacity: 0.6;
	}
	.more {
		display: flex;
		justify-content: center;
		padding: 40px 0 8px;
	}

	.empty {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: 10px;
		padding: 96px 16px;
	}
	.empty h2 {
		font-size: 1.35rem;
		margin-top: 12px;
	}
	.empty p {
		color: var(--muted);
		max-width: 360px;
		margin-bottom: 8px;
	}
	.empty-art {
		display: grid;
		grid-template-columns: repeat(2, 28px);
		gap: 5px;
	}
	.empty-art span {
		border-radius: 6px;
		background: var(--placeholder);
	}
	.empty-art span:nth-child(1) {
		height: 38px;
	}
	.empty-art span:nth-child(2) {
		height: 24px;
	}
	.empty-art span:nth-child(3) {
		height: 22px;
		margin-top: -14px;
	}
	.empty-art span:nth-child(4) {
		height: 36px;
	}

	@media (max-width: 760px) {
		.filters-inner {
			gap: 8px;
		}
		.divider {
			display: none;
		}
		.segmented button {
			padding: 0 11px;
		}
		.sort {
			display: none;
		}
	}
</style>
