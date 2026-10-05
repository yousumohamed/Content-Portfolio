<script lang="ts">
	import { untrack } from 'svelte';
	import { LoaderCircle, Upload } from '@lucide/svelte';
	import { accessToken, removeObjects } from '#lib/admin.ts';
	import { publicUrl } from '#lib/media.ts';
	import { SOCIAL_KEYS, socialLabel } from '#lib/social.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import { rasterize, uploadObject } from '#lib/upload.ts';
	import type { Profile, ProfileLinks } from '#lib/types.ts';

	let { data } = $props();

	// Editable copy of the loaded profile.
	const p = untrack(() => data.profile);
	let form = $state<Profile>({
		name: p?.name ?? '',
		headline: p?.headline ?? '',
		bio: p?.bio ?? '',
		location: p?.location ?? '',
		email: p?.email ?? '',
		avatar_path: p?.avatar_path ?? null,
		links: { ...(p?.links ?? {}) } as ProfileLinks
	});
	let saving = $state(false);
	let uploadingAvatar = $state(false);
	let fileInput = $state<HTMLInputElement>();

	const PLACEHOLDERS: Record<keyof ProfileLinks, string> = {
		instagram: 'instagram.com/yourname',
		youtube: 'youtube.com/@yourchannel',
		tiktok: 'tiktok.com/@yourname',
		x: 'x.com/yourname',
		behance: 'behance.net/yourname',
		website: 'yourdomain.com'
	};

	async function save(e?: SubmitEvent) {
		e?.preventDefault();
		if (!form.name.trim()) return toast('Name is required', 'error');
		saving = true;
		const { error } = await data.supabase
			.from('gallery_profile')
			.update({ ...form, name: form.name.trim(), updated_at: new Date().toISOString() })
			.eq('id', 1);
		saving = false;
		if (error) return toast(error.message, 'error');
		toast('Profile saved', 'success');
	}

	async function pickAvatar(file: File) {
		if (!file.type.startsWith('image/')) return toast('Choose an image file', 'error');
		uploadingAvatar = true;
		try {
			const bitmap = await createImageBitmap(file);
			// square-ish crop is done in CSS; store a sensible max size
			const blob = await rasterize(bitmap, bitmap.width, bitmap.height, 800);
			if (!blob) throw new Error('Could not process image');
			const path = `profile/avatar-${crypto.randomUUID()}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
			await uploadObject({ path, body: blob, token: await accessToken(data.supabase) });
			const old = form.avatar_path;
			form.avatar_path = path;
			await save();
			if (old) removeObjects(data.supabase, [old]);
		} catch (e) {
			toast((e as Error).message, 'error');
		} finally {
			uploadingAvatar = false;
		}
	}
</script>

<svelte:head><title>Profile — Studio</title></svelte:head>

<header class="page-head">
	<h1>Profile</h1>
	<p class="sub">How you appear on the homepage, About page and next to every post.</p>
</header>

{#if data.error}<p class="error">{data.error}</p>{/if}

<form class="wrap" onsubmit={save}>
	<section class="card-surface block">
		<h2>Identity</h2>
		<div class="avatar-row">
			<div class="avatar">
				{#if form.avatar_path}<img src={publicUrl(form.avatar_path)} alt="" />{/if}
			</div>
			<div>
				<button type="button" class="btn btn-sm" onclick={() => fileInput?.click()} disabled={uploadingAvatar}>
					{#if uploadingAvatar}<LoaderCircle size={15} class="spin" />{:else}<Upload size={15} />{/if}
					{form.avatar_path ? 'Replace photo' : 'Upload photo'}
				</button>
				<p class="hint">Used in the header and on the About page.</p>
			</div>
			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				hidden
				onchange={(e) => {
					const f = e.currentTarget.files?.[0];
					if (f) pickAvatar(f);
					e.currentTarget.value = '';
				}}
			/>
		</div>

		<div class="two">
			<label class="field">
				<span class="label">Name</span>
				<input class="input" bind:value={form.name} required />
			</label>
			<label class="field">
				<span class="label">Location</span>
				<input class="input" bind:value={form.location} placeholder="Lisbon, Portugal" />
			</label>
		</div>
		<label class="field">
			<span class="label">Headline</span>
			<input class="input" bind:value={form.headline} maxlength="140" />
			<span class="hint">One line under your name on the homepage.</span>
		</label>
		<label class="field">
			<span class="label">Bio</span>
			<textarea class="textarea" rows="7" bind:value={form.bio} placeholder="A few paragraphs about you and your work. Leave a blank line between paragraphs."></textarea>
		</label>
		<label class="field">
			<span class="label">Contact email</span>
			<input class="input" type="email" bind:value={form.email} placeholder="hello@yourdomain.com" />
			<span class="hint">Shown as the “Get in touch” button. Leave empty to hide it.</span>
		</label>
	</section>

	<section class="card-surface block">
		<h2>Links</h2>
		<div class="two">
			{#each SOCIAL_KEYS as key (key)}
				<label class="field">
					<span class="label">{socialLabel(key)}</span>
					<input class="input" bind:value={form.links[key]} placeholder={PLACEHOLDERS[key]} />
				</label>
			{/each}
		</div>
	</section>

	<div class="bar">
		<button class="btn btn-primary" disabled={saving}>
			{#if saving}<LoaderCircle size={16} class="spin" />{/if}Save profile
		</button>
	</div>
</form>

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
	.wrap {
		display: grid;
		gap: 20px;
		max-width: 760px;
	}
	.block {
		display: grid;
		gap: 18px;
		padding: 24px;
	}
	h2 {
		font-size: 1rem;
		letter-spacing: -0.01em;
	}
	.avatar-row {
		display: flex;
		align-items: center;
		gap: 18px;
	}
	.avatar {
		width: 72px;
		height: 72px;
		flex: none;
		border-radius: 50%;
		overflow: hidden;
		background: var(--placeholder);
	}
	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.avatar-row .hint {
		margin-top: 6px;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	.bar {
		position: sticky;
		bottom: 16px;
		display: flex;
		justify-content: flex-end;
	}
	.bar .btn {
		box-shadow: var(--shadow);
	}
	.error {
		color: var(--danger);
		margin-bottom: 12px;
	}
	@media (max-width: 640px) {
		.two {
			grid-template-columns: 1fr;
		}
	}
</style>
