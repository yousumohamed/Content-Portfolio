<script lang="ts">
	import { Heart, Layers, Pin, Play } from '@lucide/svelte';
	import type { FeedPost } from '../types';
	import { formatDuration, publicUrl } from '../media';
	import { compactNumber } from '../format';

	interface Props {
		post: FeedPost;
		/** Called on a plain left click — lets the page open an overlay instead of navigating. */
		onopen?: (event: MouseEvent, post: FeedPost) => void;
		eager?: boolean;
	}

	let { post, onopen, eager = false }: Props = $props();

	let loaded = $state(false);
	let previewing = $state(false);

	const isVideo = $derived(post.cover_kind === 'video');
	const thumb = $derived(publicUrl(post.cover_thumb_path ?? (isVideo ? null : post.cover_path)));
	const w = $derived(post.cover_width || 4);
	const h = $derived(post.cover_height || 5);

	function markIfComplete(img: HTMLImageElement) {
		if (img.complete && img.naturalWidth) loaded = true;
	}

	function handleClick(e: MouseEvent) {
		if (!onopen || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		onopen(e, post);
	}

	const canHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;
</script>

<a
	href="/p/{post.slug}"
	class="card"
	onclick={handleClick}
	onmouseenter={() => isVideo && canHover && (previewing = true)}
	onmouseleave={() => (previewing = false)}
	data-sveltekit-preload-data="tap"
>
	<div class="frame media-edge" style:aspect-ratio="{w} / {h}">
		{#if thumb}
			<img
				src={thumb}
				alt={post.title}
				width={w}
				height={h}
				loading={eager ? 'eager' : 'lazy'}
				decoding="async"
				class:loaded
				onload={() => (loaded = true)}
				{@attach markIfComplete}
			/>
		{:else if isVideo}
			<video
				src="{publicUrl(post.cover_path)}#t=0.1"
				muted
				playsinline
				preload="metadata"
				class="loaded"
				aria-label={post.title}
			></video>
		{/if}

		{#if isVideo && previewing}
			<video class="preview" src={publicUrl(post.cover_path)} muted autoplay loop playsinline aria-hidden="true"
			></video>
		{/if}

		<div class="badges">
			{#if post.pinned}
				<span class="badge" title="Pinned"><Pin size={13} strokeWidth={2.25} /></span>
			{/if}
			<span class="spacer"></span>
			{#if isVideo}
				<span class="badge">
					<Play size={12} strokeWidth={0} fill="currentColor" />
					{formatDuration(post.cover_duration) || 'Video'}
				</span>
			{/if}
			{#if post.media_count > 1}
				<span class="badge" title="{post.media_count} items"><Layers size={13} strokeWidth={2.25} />{post.media_count}</span>
			{/if}
		</div>
		<div class="shade"></div>
	</div>

	<div class="meta">
		<div class="text">
			<h3>{post.title}</h3>
			{#if post.category}<span class="cat">{post.category.name}</span>{/if}
		</div>
		{#if post.likes > 0}
			<span class="likes"><Heart size={13} strokeWidth={2.25} />{compactNumber(post.likes)}</span>
		{/if}
	</div>
</a>

<style>
	.card {
		display: block;
		min-width: 0;
		border-radius: var(--radius);
	}
	.frame {
		position: relative;
		overflow: hidden;
		border-radius: var(--radius);
		background: var(--placeholder);
		isolation: isolate;
	}
	.frame img,
	.frame video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition:
			opacity 0.5s var(--ease),
			transform 0.7s var(--ease);
	}
	.frame .loaded {
		opacity: 1;
	}
	.frame .preview {
		opacity: 1;
		z-index: 1;
	}
	.card:hover .frame img,
	.card:hover .frame video {
		transform: scale(1.025);
	}
	.shade {
		position: absolute;
		inset: 0;
		z-index: 2;
		background: linear-gradient(to bottom, rgb(0 0 0 / 0.22), transparent 30%);
		opacity: 0;
		transition: opacity 0.25s;
		pointer-events: none;
	}
	.card:hover .shade {
		opacity: 1;
	}
	.frame {
		transition: box-shadow 0.3s var(--ease);
	}
	.card:hover .frame {
		box-shadow: 0 10px 28px -12px rgb(0 0 0 / 0.28);
	}
	.badges {
		position: absolute;
		inset: 10px 10px auto 10px;
		z-index: 3;
		display: flex;
		gap: 6px;
	}
	.spacer {
		flex: 1;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 24px;
		padding: 0 8px;
		border-radius: 999px;
		background: rgb(14 14 15 / 0.62);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		color: #fff;
		font-size: 0.72rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.meta {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 2px 2px;
	}
	.text {
		min-width: 0;
	}
	h3 {
		font-size: 0.9rem;
		font-weight: 500;
		letter-spacing: -0.01em;
		line-height: 1.3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cat {
		display: block;
		margin-top: 2px;
		font-size: 0.78rem;
		color: var(--muted);
	}
	.likes {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		flex: none;
		padding-top: 2px;
		font-size: 0.76rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	@media (max-width: 560px) {
		.meta {
			padding-top: 8px;
		}
		h3 {
			font-size: 0.82rem;
		}
		.cat {
			font-size: 0.72rem;
		}
	}
</style>
