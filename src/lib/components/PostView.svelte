<script lang="ts">
	import { untrack } from 'svelte';
	import { ArrowUpRight, Eye, Heart, Link as LinkIcon, Maximize2 } from '@lucide/svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { FeedPost, Media, Post, Profile } from '../types';
	import { publicUrl, ratioOf } from '../media';
	import { compactNumber, formatDate } from '../format';
	import { toast } from '../toast.svelte';
	import Lightbox from './Lightbox.svelte';
	import MasonryGrid from './MasonryGrid.svelte';
	import PostCard from './PostCard.svelte';

	interface Props {
		post: Post;
		related: FeedPost[];
		profile: Profile;
		supabase: SupabaseClient;
		inOverlay?: boolean;
	}

	let { post, related, profile, supabase, inOverlay = false }: Props = $props();

	let likes = $derived(post.likes);
	let views = $derived(post.views);
	let liked = $state(false);
	let lightboxIndex = $state<number | null>(null);

	const images = $derived(post.media.filter((m) => m.kind === 'image'));
	const likeKey = $derived(`gallery:liked:${post.id}`);

	function readStorage(store: Storage | undefined, key: string) {
		try {
			return store?.getItem(key) ?? null;
		} catch {
			return null;
		}
	}
	function writeStorage(store: Storage | undefined, key: string, value: string | null) {
		try {
			if (value === null) store?.removeItem(key);
			else store?.setItem(key, value);
		} catch {
			/* storage unavailable */
		}
	}

	// Per-post client-side effects: restore like state, count one view per session.
	$effect(() => {
		const id = post.id;
		liked = readStorage(localStorage, `gallery:liked:${id}`) === '1';

		const viewKey = `gallery:viewed:${id}`;
		if (!readStorage(sessionStorage, viewKey)) {
			writeStorage(sessionStorage, viewKey, '1');
			untrack(() => (views += 1));
			supabase.rpc('gallery_track_view', { p_post_id: id }).then(({ error }) => {
				if (error) console.warn('[views]', error.message);
			});
		}
	});

	async function toggleLike() {
		const delta = liked ? -1 : 1;
		liked = !liked;
		likes = Math.max(0, likes + delta);
		writeStorage(localStorage, likeKey, liked ? '1' : null);

		const { data, error } = await supabase.rpc('gallery_like', { p_post_id: post.id, p_delta: delta });
		if (error) {
			liked = !liked;
			likes = Math.max(0, likes - delta);
			writeStorage(localStorage, likeKey, liked ? '1' : null);
			toast('Could not save that — try again', 'error');
		} else if (typeof data === 'number') {
			likes = data;
		}
	}

	async function share() {
		const url = `${location.origin}/p/${post.slug}`;
		if (navigator.share && matchMedia('(pointer: coarse)').matches) {
			try {
				await navigator.share({ title: post.title, url });
				return;
			} catch {
				/* cancelled */
			}
		}
		await navigator.clipboard.writeText(url);
		toast('Link copied', 'success');
	}

	function openLightbox(m: Media) {
		lightboxIndex = images.findIndex((i) => i.id === m.id);
	}
</script>

<article class="post" class:overlay={inOverlay}>
	<header class="head">
		<div class="title-block">
			{#if post.category}
				<a class="eyebrow" href="/?c={post.category.slug}">{post.category.name}</a>
			{/if}
			<h1>{post.title}</h1>
			<div class="facts">
				<span>{formatDate(post.published_at ?? post.created_at)}</span>
				<span class="sep"></span>
				<span class="stat"><Eye size={15} />{compactNumber(views)}</span>
				<span class="stat"><Heart size={15} />{compactNumber(likes)}</span>
			</div>
		</div>
		<div class="actions">
			<button class="btn" onclick={share}><LinkIcon size={16} />Share</button>
			<button class="btn like" class:liked onclick={toggleLike} aria-pressed={liked}>
				<Heart size={16} fill={liked ? 'currentColor' : 'none'} />
				{liked ? 'Appreciated' : 'Appreciate'}
			</button>
		</div>
	</header>

	{#if post.description}
		<p class="description">{post.description}</p>
	{/if}

	<div class="media-stack">
		{#each post.media as m, i (m.id)}
			<figure class="media media-edge" style:aspect-ratio={m.width && m.height ? `${m.width} / ${m.height}` : undefined}>
				{#if m.kind === 'image'}
					<button class="zoom" onclick={() => openLightbox(m)} aria-label="View full size">
						<img
							src={publicUrl(m.path)}
							alt={m.alt || post.title}
							width={m.width ?? undefined}
							height={m.height ?? undefined}
							loading={i < 2 ? 'eager' : 'lazy'}
							decoding="async"
						/>
						<span class="zoom-hint"><Maximize2 size={16} /></span>
					</button>
				{:else}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						src={publicUrl(m.path)}
						poster={publicUrl(m.poster_path) || undefined}
						controls
						playsinline
						preload="metadata"
						width={m.width ?? undefined}
						height={m.height ?? undefined}
						aria-label={m.alt || post.title}
					></video>
				{/if}
				{#if m.alt}<figcaption>{m.alt}</figcaption>{/if}
			</figure>
		{/each}
	</div>

	{#if post.tags.length}
		<ul class="tags" aria-label="Tags">
			{#each post.tags as tag (tag)}
				<li><a class="chip" href="/?tag={encodeURIComponent(tag)}">#{tag}</a></li>
			{/each}
		</ul>
	{/if}

	<section class="author">
		<div class="author-id">
			{#if profile.avatar_path}
				<img src={publicUrl(profile.avatar_path)} alt="" width="52" height="52" />
			{/if}
			<div>
				<strong>{profile.name}</strong>
				<span>{profile.headline}</span>
			</div>
		</div>
		<div class="author-actions">
			<button class="btn like" class:liked onclick={toggleLike} aria-pressed={liked}>
				<Heart size={16} fill={liked ? 'currentColor' : 'none'} />{compactNumber(likes)}
			</button>
			<a class="btn" href="/about">About <ArrowUpRight size={16} /></a>
		</div>
	</section>

	{#if related.length}
		<section class="related">
			<h2>More work</h2>
			<MasonryGrid
				items={related}
				key={(p) => p.id}
				ratio={(p) => ratioOf(p.cover_width, p.cover_height)}
				maxCols={4}
			>
				{#snippet children(p)}
					<PostCard post={p} />
				{/snippet}
			</MasonryGrid>
		</section>
	{/if}
</article>

{#if lightboxIndex !== null && images.length}
	<Lightbox items={images} bind:index={lightboxIndex} onclose={() => (lightboxIndex = null)} />
{/if}

<style>
	.post {
		--measure: 1240px;
		max-width: var(--measure);
		margin-inline: auto;
		padding-block: 40px 0;
	}
	.post.overlay {
		padding-top: 8px;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px 40px;
	}
	.title-block {
		min-width: 0;
		max-width: 820px;
	}
	.eyebrow {
		display: inline-block;
		margin-bottom: 10px;
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--muted);
		transition: color 0.15s;
	}
	.eyebrow:hover {
		color: var(--ink);
	}
	h1 {
		font-size: clamp(1.9rem, 4vw, 3.2rem);
		font-weight: 600;
		letter-spacing: -0.035em;
		line-height: 1.04;
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
		margin-top: 16px;
		color: var(--muted);
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
	}
	.sep {
		width: 1px;
		height: 14px;
		background: var(--line-strong);
	}
	.stat {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.actions {
		display: flex;
		gap: 8px;
	}
	.like.liked {
		--btn-fg: var(--accent);
		--btn-border: color-mix(in srgb, var(--accent) 40%, transparent);
		--btn-bg: color-mix(in srgb, var(--accent) 8%, var(--surface));
	}
	.description {
		max-width: 720px;
		margin-top: 28px;
		font-size: 1.05rem;
		line-height: 1.65;
		color: var(--ink-2);
		white-space: pre-line;
	}
	.media-stack {
		display: grid;
		gap: 16px;
		margin-top: 40px;
	}
	.media {
		position: relative;
		overflow: hidden;
		border-radius: var(--radius);
		background: var(--placeholder);
	}
	.media img,
	.media video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #000;
	}
	.media img {
		background: transparent;
	}
	.zoom {
		display: block;
		width: 100%;
		height: 100%;
		cursor: zoom-in;
	}
	.zoom-hint {
		position: absolute;
		top: 14px;
		right: 14px;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgb(14 14 15 / 0.6);
		color: #fff;
		opacity: 0;
		transition: opacity 0.2s;
	}
	.zoom:hover .zoom-hint,
	.zoom:focus-visible .zoom-hint {
		opacity: 1;
	}
	figcaption {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 28px 16px 12px;
		background: linear-gradient(transparent, rgb(0 0 0 / 0.5));
		color: #fff;
		font-size: 0.82rem;
		pointer-events: none;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		list-style: none;
		margin: 32px 0 0;
		padding: 0;
	}
	.author {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		margin-top: 56px;
		padding: 24px 0;
		border-block: 1px solid var(--line);
	}
	.author-id {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.author-id img {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		object-fit: cover;
	}
	.author-id strong {
		display: block;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.author-id span {
		font-size: 0.875rem;
		color: var(--muted);
	}
	.author-actions {
		display: flex;
		gap: 8px;
	}
	.related {
		margin-top: 56px;
	}
	.related h2 {
		margin-bottom: 20px;
		font-size: 1.25rem;
	}
	@media (max-width: 640px) {
		.post {
			padding-top: 24px;
		}
		.media-stack {
			gap: 10px;
			margin-inline: calc(var(--gutter) * -1);
		}
		.media {
			border-radius: 0;
		}
	}
</style>
