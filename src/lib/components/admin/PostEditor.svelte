<script lang="ts">
	import { untrack } from 'svelte';
	import { beforeNavigate, goto, invalidate } from '$app/navigation';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import {
		ArrowDown,
		ArrowLeft,
		ArrowUp,
		ArrowUpRight,
		CloudUpload,
		GripVertical,
		ImagePlus,
		LoaderCircle,
		Play,
		Trash,
		X
	} from '@lucide/svelte';
	import { accessToken, deletePost, removeObjects } from '../../admin';
	import { slugify, formatDate } from '../../format';
	import { formatBytes, formatDuration, publicUrl } from '../../media';
	import { toast } from '../../toast.svelte';
	import { extOf, kindOf, POSTER_WIDTH, prepareFile, rasterize, THUMB_WIDTH, uploadObject } from '../../upload';
	import { PUBLIC_MAX_UPLOAD_MB } from '$app/env/public';
	import type { Category, MediaKind, Post, PostStatus } from '../../types';

	interface Props {
		supabase: SupabaseClient;
		categories: Category[];
		post?: Post | null;
	}

	let { supabase, categories, post = null }: Props = $props();

	interface Item {
		id: string;
		kind: MediaKind;
		path: string | null;
		thumb_path: string | null;
		poster_path: string | null;
		mime: string | null;
		size_bytes: number | null;
		width: number | null;
		height: number | null;
		duration: number | null;
		alt: string;
		/** local object URL used while uploading */
		preview: string | null;
		name: string;
		state: 'processing' | 'compressing' | 'uploading' | 'ready' | 'error';
		progress: number;
		error?: string;
		/** stored in the database already */
		persisted: boolean;
	}

	// --- initial state (snapshot of the prop; the editor owns it afterwards) ---
	const initial = untrack(() => post);
	const isNew = !initial;
	const postId = initial?.id ?? crypto.randomUUID();

	let title = $state(initial?.title ?? '');
	let slug = $state(initial?.slug ?? '');
	let slugTouched = $state(!isNew);
	let description = $state(initial?.description ?? '');
	let categoryId = $state(initial?.category_id ?? '');
	let tags = $state<string[]>(initial?.tags ?? []);
	let tagDraft = $state('');
	let status = $state<PostStatus>(initial?.status ?? 'draft');
	let pinned = $state(initial?.pinned ?? false);

	let items = $state<Item[]>(
		(initial?.media ?? []).map((m) => ({
			...m,
			preview: null,
			name: m.path.split('/').pop() ?? m.path,
			state: 'ready' as const,
			progress: 1,
			persisted: true
		}))
	);
	/** persisted media removed in this session, deleted on save */
	let removed = $state<Item[]>([]);

	let saving = $state(false);
	let savedOnce = $state(false);
	let dirty = $state(false);
	let dragOver = $state(false);
	let dragIndex = $state<number | null>(null);
	let fileInput = $state<HTMLInputElement>();

	const MAX_UPLOAD_BYTES = PUBLIC_MAX_UPLOAD_MB * 1024 * 1024;
	/** files replaced by a custom thumbnail — deleted once the post is saved */
	let staleFiles: string[] = [];
	/** custom thumbnails uploaded this session — deleted if the edit is discarded */
	let pendingFiles: string[] = [];
	let thumbInput = $state<HTMLInputElement>();
	let thumbTarget: Item | null = null;
	let thumbBusy = $state<string | null>(null);

	/** original files kept so a failed upload can be retried */
	const sources = new Map<string, File>();

	const uploading = $derived(
		items.some((i) => i.state === 'processing' || i.state === 'compressing' || i.state === 'uploading')
	);
	const readyItems = $derived(items.filter((i) => i.state === 'ready'));
	const effectiveSlug = $derived(slugTouched ? slug : slugify(title));

	function touch() {
		dirty = true;
	}

	// --- files ---------------------------------------------------------------
	async function addFiles(list: FileList | File[]) {
		const files = Array.from(list);
		const rejected = files.filter((f) => !kindOf(f));
		if (rejected.length) toast(`Skipped ${rejected.length} unsupported file(s)`, 'error');

		for (const file of files.filter((f) => kindOf(f))) {
			const item: Item = {
				id: crypto.randomUUID(),
				kind: kindOf(file)!,
				path: null,
				thumb_path: null,
				poster_path: null,
				mime: file.type,
				size_bytes: file.size,
				width: null,
				height: null,
				duration: null,
				alt: '',
				preview: URL.createObjectURL(file),
				name: file.name,
				state: 'processing',
				progress: 0,
				persisted: false
			};
			items.push(item);
			touch();
			// `items` is a deep proxy — grab the reactive version to mutate.
			const live = items[items.length - 1];
			sources.set(item.id, file);
			processAndUpload(live, file);
		}
	}

	async function processAndUpload(item: Item, file: File) {
		try {
			const prepared = await prepareFile(file).catch((e: Error) => {
				// Still upload videos the browser can't decode (e.g. some .mov) — just without a poster.
				if (kindOf(file) === 'video') {
					toast(`${file.name}: no preview frame (${e.message})`);
					return { kind: 'video' as const, width: null, height: null, duration: null, thumb: null, poster: null };
				}
				throw e;
			});
			item.width = prepared.width;
			item.height = prepared.height;
			item.duration = prepared.duration;

			const body = await fitToLimit(item, file);
			item.state = 'uploading';
			item.progress = 0;

			const token = await accessToken(supabase);
			const base = `posts/${postId}/${item.id}`;
			const mainPath = `${base}.${extOf(body)}`;

			// Small derived files first (fast), then the original with progress.
			if (prepared.thumb) {
				const p = `${base}-thumb.${extOf(prepared.thumb, 'webp')}`;
				await uploadObject({ path: p, body: prepared.thumb, token });
				item.thumb_path = p;
			}
			if (prepared.poster) {
				const p = `${base}-poster.${extOf(prepared.poster, 'webp')}`;
				await uploadObject({ path: p, body: prepared.poster, token });
				item.poster_path = p;
			}
			await uploadObject({
				path: mainPath,
				body,
				token,
				onProgress: (f) => (item.progress = f)
			});
			item.path = mainPath;
			item.progress = 1;
			item.state = 'ready';
			sources.delete(item.id);
			// removed while uploading — don't leave the files behind
			if (!items.includes(item)) removeObjects(supabase, [item.path, item.thumb_path, item.poster_path]);
		} catch (e) {
			item.state = 'error';
			item.error = (e as Error).message;
			await removeObjects(supabase, [item.thumb_path, item.poster_path]);
			item.thumb_path = item.poster_path = null;
		}
	}

	/** Shrink files that exceed the Supabase per-file limit (videos are re-encoded in the browser). */
	async function fitToLimit(item: Item, file: File): Promise<File> {
		if (file.size <= MAX_UPLOAD_BYTES) return file;

		item.state = 'compressing';
		item.progress = 0;
		let out: File;

		if (item.kind === 'video') {
			const { compressVideo } = await import('../../compress');
			const res = await compressVideo(file, MAX_UPLOAD_BYTES * 0.9, (f) => (item.progress = f));
			out = res.file;
			item.width ??= res.width;
			item.height ??= res.height;
			item.duration ??= res.duration;
		} else {
			const bitmap = await createImageBitmap(file);
			const blob = await rasterize(bitmap, bitmap.width, bitmap.height, 4096);
			bitmap.close();
			if (!blob) throw new Error('Could not process image');
			const ext = blob.type === 'image/webp' ? '.webp' : '.jpg';
			out = new File([blob], file.name.replace(/\.[^.]+$/, '') + ext, { type: blob.type });
		}

		if (out.size > MAX_UPLOAD_BYTES) {
			throw new Error(
				`Still ${formatBytes(out.size)} after optimizing (limit ${formatBytes(MAX_UPLOAD_BYTES)}) — trim it or raise the limit`
			);
		}
		item.size_bytes = out.size;
		item.mime = out.type;
		item.name = out.name;
		return out;
	}

	function pickThumbnail(item: Item) {
		thumbTarget = item;
		thumbInput?.click();
	}

	/** Replace a video's auto-generated frame with a custom cover image. */
	async function setThumbnail(item: Item, file: File) {
		if (!file.type.startsWith('image/')) return toast('Choose an image file', 'error');
		thumbBusy = item.id;
		try {
			const bitmap = await createImageBitmap(file);
			const poster = await rasterize(bitmap, bitmap.width, bitmap.height, POSTER_WIDTH);
			const thumb = await rasterize(bitmap, bitmap.width, bitmap.height, THUMB_WIDTH);
			bitmap.close();
			if (!poster || !thumb) throw new Error('Could not process image');

			const token = await accessToken(supabase);
			// unique names so browsers/CDN never show the old cached cover
			const base = `posts/${postId}/${item.id}-cover-${Date.now().toString(36)}`;
			const posterPath = `${base}-poster.${extOf(poster, 'webp')}`;
			const thumbPath = `${base}-thumb.${extOf(thumb, 'webp')}`;
			await uploadObject({ path: posterPath, body: poster, token });
			await uploadObject({ path: thumbPath, body: thumb, token });

			const old = [item.poster_path, item.thumb_path].filter((p): p is string => Boolean(p));
			// an unsaved custom cover from earlier this session can go right away;
			// a saved one is still referenced by the database until we save
			const oldUnsaved = old.filter((p) => pendingFiles.includes(p) || !item.persisted);
			const oldSaved = old.filter((p) => !oldUnsaved.includes(p));
			pendingFiles = pendingFiles.filter((p) => !old.includes(p));
			pendingFiles.push(posterPath, thumbPath);
			staleFiles.push(...oldSaved);
			removeObjects(supabase, oldUnsaved);

			item.poster_path = posterPath;
			item.thumb_path = thumbPath;
			touch();
			toast('Thumbnail updated — save to apply', 'success');
		} catch (e) {
			toast((e as Error).message, 'error');
		} finally {
			thumbBusy = null;
		}
	}

	function retry(item: Item) {
		const file = sources.get(item.id);
		if (!file) return;
		item.state = 'processing';
		item.error = undefined;
		item.progress = 0;
		processAndUpload(item, file);
	}

	function removeItem(index: number) {
		const [item] = items.splice(index, 1);
		sources.delete(item.id);
		if (item.preview) URL.revokeObjectURL(item.preview);
		if (item.persisted) removed.push(item);
		else removeObjects(supabase, [item.path, item.thumb_path, item.poster_path]);
		touch();
	}

	function move(from: number, to: number) {
		if (to < 0 || to >= items.length || from === to) return;
		const [it] = items.splice(from, 1);
		items.splice(to, 0, it);
		touch();
	}

	// --- tags ----------------------------------------------------------------
	function commitTag() {
		const parts = tagDraft
			.split(',')
			.map((t) => t.trim().replace(/^#/, '').toLowerCase())
			.filter(Boolean);
		for (const t of parts) if (!tags.includes(t) && tags.length < 20) tags.push(t);
		tagDraft = '';
		if (parts.length) touch();
	}

	function onTagKey(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			commitTag();
		} else if (e.key === 'Backspace' && !tagDraft && tags.length) {
			tags.pop();
			touch();
		}
	}

	// --- save / delete -------------------------------------------------------
	async function save(nextStatus: PostStatus = status) {
		commitTag();
		if (!title.trim()) return toast('Give your post a title', 'error');
		if (!effectiveSlug) return toast('The URL slug is empty', 'error');
		if (uploading) return toast('Wait for uploads to finish', 'error');
		if (nextStatus === 'published' && !readyItems.length) return toast('Add at least one image or video to publish', 'error');

		saving = true;
		try {
			const record = {
				id: postId,
				title: title.trim(),
				slug: effectiveSlug,
				description: description.trim(),
				category_id: categoryId || null,
				tags,
				status: nextStatus,
				pinned
			};
			const { error: postErr } = isNew && !savedOnce
				? await supabase.from('gallery_posts').insert(record)
				: await supabase.from('gallery_posts').update(record).eq('id', postId);
			if (postErr) {
				throw new Error(postErr.code === '23505' ? 'That URL slug is already used by another post' : postErr.message);
			}

			if (removed.length) {
				const ids = removed.map((r) => r.id);
				const { error } = await supabase.from('gallery_media').delete().in('id', ids);
				if (error) throw new Error(error.message);
				await removeObjects(
					supabase,
					removed.flatMap((r) => [r.path, r.thumb_path, r.poster_path])
				);
				removed = [];
			}

			const rows = readyItems.map((m, position) => ({
				id: m.id,
				post_id: postId,
				kind: m.kind,
				path: m.path!,
				thumb_path: m.thumb_path,
				poster_path: m.poster_path,
				mime: m.mime,
				size_bytes: m.size_bytes,
				width: m.width,
				height: m.height,
				duration: m.duration,
				alt: m.alt.trim(),
				position
			}));
			if (rows.length) {
				const { error } = await supabase.from('gallery_media').upsert(rows, { onConflict: 'id' });
				if (error) throw new Error(error.message);
			}
			for (const m of items) if (m.state === 'ready') m.persisted = true;
			if (staleFiles.length) await removeObjects(supabase, staleFiles);
			staleFiles = [];
			pendingFiles = [];

			status = nextStatus;
			slug = effectiveSlug;
			slugTouched = true;
			dirty = false;
			savedOnce = true;
			toast(nextStatus === 'published' ? 'Published' : 'Saved', 'success');
			invalidate('admin:posts');
			if (isNew) goto(`/admin/posts/${postId}`, { replace: true });
		} catch (e) {
			toast((e as Error).message, 'error');
		} finally {
			saving = false;
		}
	}
	async function destroy() {
		if (!confirm('Delete this post and all of its files? This cannot be undone.')) return;
		saving = true;
		try {
			await deletePost(supabase, postId);
			dirty = false;
			toast('Post deleted', 'success');
			goto('/admin', { replace: true });
		} catch (e) {
			toast((e as Error).message, 'error');
			saving = false;
		}
	}

	// --- leaving with unsaved work -------------------------------------------
	beforeNavigate((nav) => {
		if (!dirty && !uploading) return;
		if (nav.type === 'leave') {
			nav.cancel(); // triggers the native "leave site?" prompt
			return;
		}
		if (!confirm('You have unsaved changes. Leave and discard them?')) {
			nav.cancel();
			return;
		}
		// discard: clean up files uploaded in this session that were never saved
		removeObjects(
			supabase,
			[
				...items.filter((i) => !i.persisted).flatMap((i) => [i.path, i.thumb_path, i.poster_path]),
				...pendingFiles
			]
		);
	});

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (dragIndex !== null) return;
		if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
	}

	function onPaste(e: ClipboardEvent) {
		const files = Array.from(e.clipboardData?.files ?? []);
		if (files.length) addFiles(files);
	}
</script>

<svelte:window onpaste={onPaste} />

<div class="editor">
	<header class="top">
		<a class="back" href="/admin"><ArrowLeft size={16} />Posts</a>
		<div class="top-actions">
			{#if !isNew && status === 'published'}
				<a class="btn btn-ghost btn-sm" href="/p/{slug}" target="_blank" rel="noopener">View <ArrowUpRight size={15} /></a>
			{/if}
			<span class="save-state">
				{#if uploading}Uploading…{:else if dirty}Unsaved changes{:else if !isNew}Saved{/if}
			</span>
		</div>
	</header>

	<div class="grid">
		<!-- Media column -->
		<section class="media-col">
			<div
				class="dropzone"
				class:over={dragOver}
				role="button"
				tabindex="0"
				aria-label="Upload images or videos"
				ondragover={(e) => {
					e.preventDefault();
					if (dragIndex === null) dragOver = true;
				}}
				ondragleave={() => (dragOver = false)}
				ondrop={onDrop}
				onclick={() => fileInput?.click()}
				onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInput?.click())}
			>
				<CloudUpload size={26} strokeWidth={1.75} />
				<strong>Drop images or videos here</strong>
				<span>or click to browse · paste works too · JPG, PNG, WebP, GIF, MP4, WebM, MOV</span>
				<input
					bind:this={fileInput}
					type="file"
					accept="image/*,video/*"
					multiple
					hidden
					onchange={(e) => {
						if (e.currentTarget.files) addFiles(e.currentTarget.files);
						e.currentTarget.value = '';
					}}
				/>
			</div>

			<input
				bind:this={thumbInput}
				type="file"
				accept="image/*"
				hidden
				onchange={(e) => {
					const file = e.currentTarget.files?.[0];
					if (file && thumbTarget) setThumbnail(thumbTarget, file);
					e.currentTarget.value = '';
				}}
			/>

			{#if items.length}
				<ol class="items">
					{#each items as item, i (item.id)}
						{@const src = item.preview && item.kind === 'image' ? item.preview : publicUrl(item.thumb_path ?? (item.kind === 'image' ? item.path : null))}
						<li
							class="item"
							class:dragging={dragIndex === i}
							draggable="true"
							ondragstart={(e) => {
								dragIndex = i;
								e.dataTransfer?.setData('text/plain', String(i));
							}}
							ondragend={() => (dragIndex = null)}
							ondragover={(e) => {
								e.preventDefault();
								if (dragIndex !== null && dragIndex !== i) {
									move(dragIndex, i);
									dragIndex = i;
								}
							}}
						>
							<span class="handle" aria-hidden="true"><GripVertical size={16} /></span>

							<div class="preview media-edge" style:aspect-ratio={item.width && item.height ? `${item.width}/${item.height}` : '4/3'}>
								{#if src}
									<img {src} alt="" />
								{:else if item.kind === 'video' && (item.preview || item.path)}
									<!-- svelte-ignore a11y_media_has_caption -->
									<video src={item.preview ?? publicUrl(item.path)} muted preload="metadata"></video>
								{/if}
								{#if item.kind === 'video'}
									<span class="vid"><Play size={10} fill="currentColor" strokeWidth={0} />{formatDuration(item.duration)}</span>
								{/if}
								{#if item.state === 'processing' || item.state === 'compressing' || item.state === 'uploading'}
									<div class="progress"><span style:width="{Math.round(item.progress * 100)}%"></span></div>
								{/if}
								{#if i === 0 && item.state === 'ready'}<span class="cover-tag">Cover</span>{/if}
							</div>

							<div class="item-body">
								<div class="item-head">
									<span class="fname" title={item.name}>{item.name}</span>
									<span class="fmeta">
										{#if item.state === 'processing'}Preparing…
										{:else if item.state === 'compressing'}Optimizing for web · {Math.round(item.progress * 100)}%
										{:else if item.state === 'uploading'}Uploading · {Math.round(item.progress * 100)}%
										{:else if item.state === 'error'}<span class="err">{item.error}</span>
											{#if sources.has(item.id)}<button class="retry" onclick={() => retry(item)}>Retry</button>{/if}
										{:else}{[item.width && item.height ? `${item.width}×${item.height}` : '', formatBytes(item.size_bytes)].filter(Boolean).join(' · ')}{/if}
									</span>
								</div>
								{#if item.kind === 'video' && item.state === 'ready'}
									<button
										type="button"
										class="btn btn-sm thumb-btn"
										onclick={() => pickThumbnail(item)}
										disabled={thumbBusy === item.id}
									>
										{#if thumbBusy === item.id}<LoaderCircle size={14} class="spin" />{:else}<ImagePlus size={14} />{/if}
										{item.thumb_path ? 'Change thumbnail' : 'Set thumbnail'}
									</button>
								{/if}
								<label class="sr-only" for="alt-{item.id}">Caption / alt text</label>
								<input
									id="alt-{item.id}"
									class="input alt"
									placeholder="Caption / alt text (optional)"
									bind:value={item.alt}
									oninput={touch}
									disabled={item.state === 'error'}
								/>
							</div>

							<div class="item-actions">
								<button class="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onclick={() => move(i, i - 1)} aria-label="Move up"><ArrowUp size={15} /></button>
								<button class="btn btn-ghost btn-icon btn-sm" disabled={i === items.length - 1} onclick={() => move(i, i + 1)} aria-label="Move down"><ArrowDown size={15} /></button>
								<button class="btn btn-ghost btn-icon btn-sm danger" onclick={() => removeItem(i)} aria-label="Remove"><Trash size={15} /></button>
							</div>
						</li>
					{/each}
				</ol>
				<p class="hint">Drag to reorder. The first item is the cover shown in the grid.</p>
			{/if}
		</section>

		<!-- Details column -->
		<aside class="details card-surface">
			<label class="field">
				<span class="label">Title</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input class="input title-input" bind:value={title} oninput={touch} placeholder="Untitled project" autofocus={isNew} />
			</label>

			<label class="field">
				<span class="label">URL</span>
				<div class="slug">
					<span>/p/</span>
					<input
						class="input"
						value={effectiveSlug}
						oninput={(e) => {
							slugTouched = true;
							slug = slugify(e.currentTarget.value) || e.currentTarget.value;
							touch();
						}}
					/>
				</div>
			</label>

			<label class="field">
				<span class="label">Description</span>
				<textarea class="textarea" rows="5" bind:value={description} oninput={touch} placeholder="The story behind this work, tools used, credits…"></textarea>
			</label>

			<label class="field">
				<span class="label">Category</span>
				<select class="select" bind:value={categoryId} onchange={touch}>
					<option value="">No category</option>
					{#each categories as c (c.id)}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
				{#if !categories.length}
					<span class="hint"><a href="/admin/categories" class="link">Create categories</a> to organise your work.</span>
				{/if}
			</label>

			<div class="field">
				<label class="label" for="tag-input">Tags</label>
				<div class="tags">
					{#each tags as t, i (t)}
						<span class="tag">#{t}<button aria-label="Remove {t}" onclick={() => (tags.splice(i, 1), touch())}><X size={12} /></button></span>
					{/each}
					<input
						id="tag-input"
						bind:value={tagDraft}
						onkeydown={onTagKey}
						onblur={commitTag}
						placeholder={tags.length ? '' : 'portrait, street, 35mm'}
					/>
				</div>
			</div>

			<label class="toggle">
				<input type="checkbox" bind:checked={pinned} onchange={touch} />
				<span class="switch" aria-hidden="true"></span>
				<span>
					<strong>Pin to top</strong>
					<small>Shown first in the gallery</small>
				</span>
			</label>

			<div class="publish">
				<div class="status-line">
					<span class="pill {status}">{status === 'published' ? 'Published' : 'Draft'}</span>
					{#if initial?.published_at}<span class="hint">since {formatDate(initial.published_at)}</span>{/if}
				</div>
				<div class="buttons">
					{#if status === 'published'}
						<button class="btn" disabled={saving} onclick={() => save('draft')}>Unpublish</button>
						<button class="btn btn-primary" disabled={saving || uploading} onclick={() => save('published')}>
							{#if saving}<LoaderCircle size={16} class="spin" />{/if}Save changes
						</button>
					{:else}
						<button class="btn" disabled={saving || uploading} onclick={() => save('draft')}>Save draft</button>
						<button class="btn btn-primary" disabled={saving || uploading} onclick={() => save('published')}>
							{#if saving}<LoaderCircle size={16} class="spin" />{/if}Publish
						</button>
					{/if}
				</div>
			</div>

			{#if !isNew || savedOnce}
				<button class="btn btn-ghost btn-sm delete" onclick={destroy} disabled={saving}><Trash size={14} />Delete post</button>
			{/if}
		</aside>
	</div>
</div>

<style>
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 20px;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.back:hover {
		color: var(--ink);
	}
	.top-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.save-state {
		font-size: 0.82rem;
		color: var(--muted);
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 380px;
		gap: 28px;
		align-items: start;
	}
	.dropzone {
		display: grid;
		justify-items: center;
		gap: 6px;
		padding: 40px 24px;
		border: 1.5px dashed var(--line-strong);
		border-radius: var(--radius-lg);
		background: var(--surface);
		color: var(--muted);
		text-align: center;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s;
	}
	.dropzone strong {
		margin-top: 6px;
		color: var(--ink);
		font-weight: 600;
	}
	.dropzone span {
		font-size: 0.8rem;
	}
	.dropzone:hover,
	.dropzone.over {
		border-color: var(--ink);
		background: color-mix(in srgb, var(--surface-2) 60%, var(--surface));
	}
	.items {
		list-style: none;
		margin: 16px 0 0;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.item {
		display: grid;
		grid-template-columns: 20px 112px minmax(0, 1fr) auto;
		align-items: center;
		gap: 14px;
		padding: 10px 10px 10px 6px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		transition:
			box-shadow 0.15s,
			opacity 0.15s;
	}
	.item.dragging {
		opacity: 0.4;
	}
	.handle {
		display: grid;
		place-items: center;
		color: var(--muted);
		cursor: grab;
	}
	.preview {
		position: relative;
		width: 112px;
		max-height: 112px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--placeholder);
	}
	.preview img,
	.preview video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.vid {
		position: absolute;
		left: 6px;
		bottom: 6px;
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 2px 6px;
		border-radius: 999px;
		background: rgb(0 0 0 / 0.6);
		color: #fff;
		font-size: 0.68rem;
		font-weight: 600;
	}
	.cover-tag {
		position: absolute;
		top: 6px;
		left: 6px;
		padding: 2px 7px;
		border-radius: 999px;
		background: var(--ink);
		color: var(--bg);
		font-size: 0.66rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}
	.progress {
		position: absolute;
		left: 8px;
		right: 8px;
		bottom: 8px;
		height: 4px;
		border-radius: 4px;
		background: rgb(255 255 255 / 0.4);
		overflow: hidden;
	}
	.progress span {
		display: block;
		height: 100%;
		background: #fff;
		transition: width 0.2s;
	}
	.item-body {
		display: grid;
		gap: 8px;
		min-width: 0;
	}
	.item-head {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 0.82rem;
	}
	.fname {
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.fmeta {
		flex: none;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.fmeta .err {
		color: var(--danger);
	}
	.retry {
		margin-left: 8px;
		font-weight: 600;
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.thumb-btn {
		justify-self: start;
	}
	.alt {
		min-height: 36px;
		padding-block: 6px;
		font-size: 0.85rem;
	}
	.item-actions {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.item-actions .danger:hover {
		color: var(--danger);
	}
	.hint {
		margin-top: 10px;
	}
	.details {
		position: sticky;
		top: 24px;
		display: grid;
		gap: 18px;
		padding: 22px;
	}
	.title-input {
		font-size: 1.05rem;
		font-weight: 500;
	}
	.slug {
		display: flex;
		align-items: center;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		overflow: hidden;
	}
	.slug span {
		padding: 0 4px 0 12px;
		font-size: 0.88rem;
		color: var(--muted);
	}
	.slug .input {
		border: 0;
		border-radius: 0;
		min-height: 40px;
		padding-left: 2px;
	}
	.link {
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		min-height: 42px;
		padding: 6px 8px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--surface);
	}
	.tags:focus-within {
		border-color: var(--ink);
	}
	.tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 28px;
		padding: 0 6px 0 10px;
		border-radius: 999px;
		background: var(--surface-2);
		font-size: 0.82rem;
	}
	.tag button {
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		color: var(--muted);
	}
	.tag button:hover {
		background: var(--line);
		color: var(--ink);
	}
	.tags input {
		flex: 1;
		min-width: 120px;
		border: 0;
		outline: none;
		background: transparent;
		font-size: 0.9rem;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 12px;
		cursor: pointer;
	}
	.toggle input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.switch {
		position: relative;
		flex: none;
		width: 36px;
		height: 22px;
		border-radius: 999px;
		background: var(--line-strong);
		transition: background 0.2s;
	}
	.switch::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #fff;
		box-shadow: var(--shadow-sm);
		transition: transform 0.2s var(--ease);
	}
	.toggle input:checked + .switch {
		background: var(--ink);
	}
	.toggle input:checked + .switch::after {
		transform: translateX(14px);
	}
	.toggle input:focus-visible + .switch {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.toggle strong {
		display: block;
		font-size: 0.88rem;
		font-weight: 500;
	}
	.toggle small {
		font-size: 0.78rem;
		color: var(--muted);
	}
	.publish {
		display: grid;
		gap: 12px;
		padding-top: 18px;
		border-top: 1px solid var(--line);
	}
	.status-line {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.status-line .hint {
		margin: 0;
	}
	.buttons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.buttons .btn {
		height: 42px;
	}
	.delete {
		justify-self: start;
		color: var(--danger);
	}
	@media (max-width: 1080px) {
		.grid {
			grid-template-columns: 1fr;
		}
		.details {
			position: static;
			order: -1;
		}
	}
	@media (max-width: 560px) {
		.item {
			grid-template-columns: 76px minmax(0, 1fr);
			padding: 10px;
		}
		.handle {
			display: none;
		}
		.preview {
			width: 76px;
		}
		.item-actions {
			grid-column: 1 / -1;
			flex-direction: row;
			justify-content: flex-end;
		}
	}
</style>
