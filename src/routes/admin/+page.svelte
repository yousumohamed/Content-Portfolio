<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { Eye, Heart, Layers, Pencil, Pin, Play, Plus, Search, Trash, ArrowUpRight } from '@lucide/svelte';
	import { deletePost } from '#lib/admin.ts';
	import { compactNumber, formatDate } from '#lib/format.ts';
	import { publicUrl } from '#lib/media.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import type { AdminPost } from './+page.ts';

	let { data } = $props();

	let query = $state('');
	let status = $state<'all' | 'published' | 'draft'>('all');
	let busy = $state<string | null>(null);

	const stats = $derived({
		total: data.posts.length,
		published: data.posts.filter((p) => p.status === 'published').length,
		drafts: data.posts.filter((p) => p.status === 'draft').length,
		views: data.posts.reduce((n, p) => n + p.views, 0),
		likes: data.posts.reduce((n, p) => n + p.likes, 0)
	});

	const filtered = $derived(
		data.posts.filter((p) => {
			if (status !== 'all' && p.status !== status) return false;
			const q = query.trim().toLowerCase();
			if (!q) return true;
			return (
				p.title.toLowerCase().includes(q) ||
				p.category?.name.toLowerCase().includes(q) ||
				p.tags.some((t) => t.toLowerCase().includes(q))
			);
		})
	);

	async function update(post: AdminPost, patch: Partial<AdminPost>, message: string) {
		busy = post.id;
		const { error } = await data.supabase.from('gallery_posts').update(patch).eq('id', post.id);
		busy = null;
		if (error) return toast(error.message, 'error');
		toast(message, 'success');
		invalidate('admin:posts');
	}

	async function remove(post: AdminPost) {
		if (!confirm(`Delete “${post.title}” and all of its files? This cannot be undone.`)) return;
		busy = post.id;
		try {
			await deletePost(data.supabase, post.id);
			toast('Post deleted', 'success');
			await invalidate('admin:posts');
		} catch (e) {
			toast((e as Error).message, 'error');
		} finally {
			busy = null;
		}
	}
</script>

<svelte:head><title>Posts — Studio</title></svelte:head>

<header class="page-head">
	<div>
		<h1>Posts</h1>
		<p class="sub">Everything you've uploaded. Published posts are public.</p>
	</div>
	<a class="btn btn-primary" href="/admin/posts/new"><Plus size={17} />New post</a>
</header>

<section class="stats" aria-label="Overview">
	<div class="stat"><span>Total posts</span><strong>{stats.total}</strong></div>
	<div class="stat"><span>Published</span><strong>{stats.published}</strong></div>
	<div class="stat"><span>Drafts</span><strong>{stats.drafts}</strong></div>
	<div class="stat"><span>Views</span><strong>{compactNumber(stats.views)}</strong></div>
	<div class="stat"><span>Appreciations</span><strong>{compactNumber(stats.likes)}</strong></div>
</section>

<div class="toolbar">
	<div class="segmented" role="group" aria-label="Status">
		{#each [['all', 'All'], ['published', 'Published'], ['draft', 'Drafts']] as [value, label] (value)}
			<button aria-pressed={status === value} onclick={() => (status = value as typeof status)}>{label}</button>
		{/each}
	</div>
	<label class="search">
		<Search size={16} />
		<span class="sr-only">Filter posts</span>
		<input class="input" placeholder="Filter by title, category or tag" bind:value={query} />
	</label>
</div>

{#if data.error}
	<p class="error card-surface">{data.error}</p>
{/if}

{#if filtered.length}
	<ul class="list card-surface">
		{#each filtered as post (post.id)}
			{@const thumb = publicUrl(post.cover_thumb_path ?? (post.cover_kind === 'image' ? post.cover_path : null))}
			<li class="row" class:busy={busy === post.id}>
				<a class="thumb" href="/admin/posts/{post.id}" aria-label="Edit {post.title}">
					{#if thumb}
						<img src={thumb} alt="" loading="lazy" />
					{/if}
					{#if post.cover_kind === 'video'}
						<span class="kind"><Play size={10} fill="currentColor" strokeWidth={0} /></span>
					{/if}
				</a>

				<div class="info">
					<a class="title" href="/admin/posts/{post.id}">
						{#if post.pinned}<Pin size={13} class="pin" />{/if}
						{post.title}
					</a>
					<div class="meta">
						<span class="pill {post.status}">{post.status === 'published' ? 'Published' : 'Draft'}</span>
						{#if post.category}<span>{post.category.name}</span>{/if}
						<span class="m"><Layers size={13} />{post.media_count}</span>
						<span class="m"><Eye size={13} />{compactNumber(post.views)}</span>
						<span class="m"><Heart size={13} />{compactNumber(post.likes)}</span>
						<span class="date">Edited {formatDate(post.updated_at)}</span>
					</div>
				</div>

				<div class="actions">
					<button
						class="btn btn-sm"
						onclick={() =>
							update(
								post,
								{ status: post.status === 'published' ? 'draft' : 'published' },
								post.status === 'published' ? 'Moved to drafts' : 'Published'
							)}
					>
						{post.status === 'published' ? 'Unpublish' : 'Publish'}
					</button>
					<button
						class="btn btn-sm btn-icon"
						class:on={post.pinned}
						title={post.pinned ? 'Unpin' : 'Pin to top'}
						aria-label={post.pinned ? 'Unpin' : 'Pin to top'}
						onclick={() => update(post, { pinned: !post.pinned }, post.pinned ? 'Unpinned' : 'Pinned to top')}
					>
						<Pin size={15} />
					</button>
					{#if post.status === 'published'}
						<a class="btn btn-sm btn-icon" href="/p/{post.slug}" target="_blank" rel="noopener" title="View" aria-label="View on site">
							<ArrowUpRight size={15} />
						</a>
					{/if}
					<a class="btn btn-sm btn-icon" href="/admin/posts/{post.id}" title="Edit" aria-label="Edit"><Pencil size={15} /></a>
					<button class="btn btn-sm btn-icon btn-danger" title="Delete" aria-label="Delete" onclick={() => remove(post)}>
						<Trash size={15} />
					</button>
				</div>
			</li>
		{/each}
	</ul>
{:else}
	<div class="empty card-surface">
		{#if data.posts.length}
			<p>No posts match your filters.</p>
		{:else}
			<h2>Upload your first piece</h2>
			<p>Drop in photos or videos, give it a title and publish — it appears on your site instantly.</p>
			<a class="btn btn-primary" href="/admin/posts/new"><Plus size={17} />New post</a>
		{/if}
	</div>
{/if}

<style>
	.page-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 28px;
	}
	h1 {
		font-size: 1.85rem;
		letter-spacing: -0.03em;
	}
	.sub {
		margin-top: 6px;
		color: var(--muted);
		font-size: 0.92rem;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		overflow: hidden;
	}
	.stat {
		display: grid;
		gap: 4px;
		padding: 16px 18px;
		border-right: 1px solid var(--line);
	}
	.stat:last-child {
		border-right: 0;
	}
	.stat span {
		font-size: 0.78rem;
		color: var(--muted);
	}
	.stat strong {
		font-size: 1.5rem;
		font-weight: 600;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin: 28px 0 14px;
	}
	.segmented {
		display: inline-flex;
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
	}
	.segmented button[aria-pressed='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: var(--shadow-sm);
	}
	.search {
		position: relative;
		display: flex;
		align-items: center;
		width: min(340px, 100%);
		color: var(--muted);
	}
	.search :global(svg) {
		position: absolute;
		left: 12px;
	}
	.search .input {
		padding-left: 36px;
		border-radius: 999px;
		min-height: 38px;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow: hidden;
	}
	.row {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr) auto;
		align-items: center;
		gap: 16px;
		padding: 12px 14px;
		border-bottom: 1px solid var(--line);
		transition:
			opacity 0.15s,
			background 0.15s;
	}
	.row:last-child {
		border-bottom: 0;
	}
	.row:hover {
		background: color-mix(in srgb, var(--surface-2) 50%, transparent);
	}
	.row.busy {
		opacity: 0.5;
		pointer-events: none;
	}
	.thumb {
		position: relative;
		width: 64px;
		height: 64px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--placeholder);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.kind {
		position: absolute;
		right: 4px;
		bottom: 4px;
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: rgb(0 0 0 / 0.6);
		color: #fff;
	}
	.info {
		min-width: 0;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.title:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.title :global(.pin) {
		flex: none;
		color: var(--accent);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 14px;
		margin-top: 6px;
		font-size: 0.8rem;
		color: var(--muted);
	}
	.m {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-variant-numeric: tabular-nums;
	}
	.actions {
		display: flex;
		gap: 6px;
	}
	.actions .on {
		--btn-fg: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.error {
		padding: 14px 16px;
		color: var(--danger);
		margin-bottom: 14px;
	}
	.empty {
		display: grid;
		justify-items: center;
		gap: 10px;
		padding: 64px 24px;
		text-align: center;
	}
	.empty h2 {
		font-size: 1.3rem;
	}
	.empty p {
		max-width: 380px;
		color: var(--muted);
		margin-bottom: 8px;
	}
	@media (max-width: 960px) {
		.stats {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.stat:nth-child(3) {
			border-right: 0;
		}
		.stat:nth-child(n + 4) {
			border-top: 1px solid var(--line);
		}
	}
	@media (max-width: 700px) {
		.row {
			grid-template-columns: 56px minmax(0, 1fr);
		}
		.thumb {
			width: 56px;
			height: 56px;
		}
		.actions {
			grid-column: 1 / -1;
			flex-wrap: wrap;
		}
		.date {
			display: none;
		}
	}
</style>
