<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { ArrowDown, ArrowUp, Plus, Trash } from '@lucide/svelte';
	import { slugify } from '#lib/format.ts';
	import { toast } from '#lib/toast.svelte.ts';

	let { data } = $props();

	let name = $state('');
	let busy = $state(false);

	const refresh = () => invalidate('admin:categories');

	async function add(e: SubmitEvent) {
		e.preventDefault();
		const clean = name.trim();
		if (!clean) return;
		busy = true;
		const position = data.categories.length ? Math.max(...data.categories.map((c) => c.position)) + 1 : 0;
		const { error } = await data.supabase.from('gallery_categories').insert({ name: clean, slug: slugify(clean), position });
		busy = false;
		if (error) return toast(error.code === '23505' ? 'A category with that name exists' : error.message, 'error');
		name = '';
		toast('Category added', 'success');
		refresh();
	}

	async function rename(id: string, current: string, next: string) {
		const clean = next.trim();
		if (!clean || clean === current) return;
		const { error } = await data.supabase
			.from('gallery_categories')
			.update({ name: clean, slug: slugify(clean) })
			.eq('id', id);
		if (error) return toast(error.code === '23505' ? 'A category with that name exists' : error.message, 'error');
		toast('Renamed', 'success');
		refresh();
	}

	async function move(index: number, dir: -1 | 1) {
		const list = [...data.categories];
		const target = index + dir;
		if (target < 0 || target >= list.length) return;
		[list[index], list[target]] = [list[target], list[index]];
		const results = await Promise.all(
			list.map((c, position) => data.supabase.from('gallery_categories').update({ position }).eq('id', c.id))
		);
		const failed = results.find((r) => r.error);
		if (failed?.error) toast(failed.error.message, 'error');
		refresh();
	}

	async function remove(id: string, label: string, count: number) {
		const msg = count
			? `Delete “${label}”? Its ${count} post(s) will stay, just without a category.`
			: `Delete “${label}”?`;
		if (!confirm(msg)) return;
		const { error } = await data.supabase.from('gallery_categories').delete().eq('id', id);
		if (error) return toast(error.message, 'error');
		toast('Category deleted', 'success');
		refresh();
	}
</script>

<svelte:head><title>Categories — Studio</title></svelte:head>

<header class="page-head">
	<h1>Categories</h1>
	<p class="sub">Group your work — visitors can filter the gallery by these.</p>
</header>

<form class="add card-surface" onsubmit={add}>
	<label class="sr-only" for="cat-name">New category</label>
	<input id="cat-name" class="input" placeholder="e.g. Portraits, Travel, Brand films" bind:value={name} />
	<button class="btn btn-primary" disabled={busy || !name.trim()}><Plus size={16} />Add</button>
</form>

{#if data.error}<p class="error">{data.error}</p>{/if}

{#if data.categories.length}
	<ul class="list card-surface">
		{#each data.categories as c, i (c.id)}
			<li>
				<input
					class="name"
					value={c.name}
					aria-label="Category name"
					onblur={(e) => rename(c.id, c.name, e.currentTarget.value)}
					onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
				/>
				<span class="slug">/?c={c.slug}</span>
				<span class="count">{c.count} {c.count === 1 ? 'post' : 'posts'}</span>
				<div class="actions">
					<button class="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onclick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={15} /></button>
					<button class="btn btn-ghost btn-icon btn-sm" disabled={i === data.categories.length - 1} onclick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={15} /></button>
					<button class="btn btn-ghost btn-icon btn-sm danger" onclick={() => remove(c.id, c.name, c.count)} aria-label="Delete"><Trash size={15} /></button>
				</div>
			</li>
		{/each}
	</ul>
	<p class="hint">Click a name to rename it. Order here is the order of filters on your site.</p>
{:else}
	<p class="empty">No categories yet.</p>
{/if}

<style>
	.page-head {
		margin-bottom: 24px;
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
	.add {
		display: flex;
		gap: 10px;
		max-width: 720px;
		padding: 10px;
	}
	.add .input {
		border-color: transparent;
	}
	.list {
		list-style: none;
		max-width: 720px;
		margin: 16px 0 0;
		padding: 0;
		overflow: hidden;
	}
	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto auto;
		align-items: center;
		gap: 16px;
		padding: 8px 10px 8px 6px;
		border-bottom: 1px solid var(--line);
	}
	li:last-child {
		border-bottom: 0;
	}
	.name {
		min-width: 0;
		height: 36px;
		padding: 0 10px;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		font-weight: 500;
	}
	.name:hover {
		border-color: var(--line);
	}
	.name:focus {
		outline: none;
		border-color: var(--ink);
		background: var(--surface);
	}
	.slug,
	.count {
		font-size: 0.8rem;
		color: var(--muted);
		white-space: nowrap;
	}
	.actions {
		display: flex;
		gap: 2px;
	}
	.danger:hover {
		color: var(--danger);
	}
	.hint {
		margin-top: 10px;
	}
	.error {
		color: var(--danger);
		margin-top: 12px;
	}
	.empty {
		margin-top: 20px;
		color: var(--muted);
	}
	@media (max-width: 600px) {
		.slug {
			display: none;
		}
	}
</style>
