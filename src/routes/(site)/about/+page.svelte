<script lang="ts">
	import { ArrowUpRight, Mail, MapPin } from '@lucide/svelte';
	import { publicUrl } from '#lib/media.ts';
	import { plural } from '#lib/format.ts';
	import { socialLinks } from '#lib/social.ts';

	let { data } = $props();
	const profile = $derived(data.profile);
	const links = $derived(socialLinks(profile.links));
</script>

<svelte:head>
	<title>About — {profile.name}</title>
	<meta name="description" content={profile.headline} />
</svelte:head>

<div class="container about">
	<aside class="portrait media-edge">
		{#if profile.avatar_path}
			<img src={publicUrl(profile.avatar_path)} alt={profile.name} />
		{:else}
			<div class="placeholder" aria-hidden="true"></div>
		{/if}
	</aside>

	<div class="body">
		<p class="eyebrow">About</p>
		<h1>{profile.headline}</h1>

		{#if profile.bio}
			<div class="bio">
				{#each profile.bio.split(/\n{2,}/) as para, i (i)}
					<p>{para}</p>
				{/each}
			</div>
		{/if}

		<dl class="meta">
			{#if profile.location}
				<div>
					<dt>Based in</dt>
					<dd><MapPin size={15} />{profile.location}</dd>
				</div>
			{/if}
			<div>
				<dt>Published</dt>
				<dd>{plural(data.totalPosts, 'project')}</dd>
			</div>
			{#if profile.email}
				<div>
					<dt>Email</dt>
					<dd><a href="mailto:{profile.email}">{profile.email}</a></dd>
				</div>
			{/if}
		</dl>

		{#if links.length}
			<ul class="links">
				{#each links as l (l.key)}
					<li>
						<a href={l.href} target="_blank" rel="noopener noreferrer">
							<span>{l.label}</span><ArrowUpRight size={18} />
						</a>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="cta">
			{#if profile.email}
				<a class="btn btn-primary" href="mailto:{profile.email}"><Mail size={16} />Start a project</a>
			{/if}
			<a class="btn" href="/">See the work</a>
		</div>
	</div>
</div>

<style>
	.about {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
		gap: clamp(32px, 6vw, 96px);
		padding-top: clamp(32px, 6vw, 80px);
		align-items: start;
	}
	.portrait {
		position: sticky;
		top: calc(var(--header-h) + 24px);
		border-radius: var(--radius-lg);
	}
	.portrait img,
	.placeholder {
		width: 100%;
		aspect-ratio: 4 / 5;
		object-fit: cover;
		border-radius: var(--radius-lg);
		background: var(--placeholder);
	}
	.eyebrow {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--muted);
		margin-bottom: 14px;
	}
	h1 {
		font-size: clamp(2rem, 4.2vw, 3.6rem);
		letter-spacing: -0.04em;
		line-height: 1.02;
	}
	.bio {
		display: grid;
		gap: 16px;
		margin-top: 32px;
		max-width: 640px;
		font-size: 1.08rem;
		line-height: 1.7;
		color: var(--ink-2);
	}
	.meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 20px;
		margin: 40px 0 0;
		padding-top: 24px;
		border-top: 1px solid var(--line);
	}
	dt {
		font-size: 0.78rem;
		color: var(--muted);
		margin-bottom: 4px;
	}
	dd {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-weight: 500;
	}
	dd a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.links {
		list-style: none;
		margin: 40px 0 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}
	.links a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18px 0;
		border-bottom: 1px solid var(--line);
		font-size: clamp(1.15rem, 2vw, 1.5rem);
		font-weight: 500;
		letter-spacing: -0.02em;
		transition: padding 0.25s var(--ease);
	}
	.links a :global(svg) {
		color: var(--muted);
		transition: color 0.2s;
	}
	.links a:hover {
		padding-inline: 8px;
	}
	.links a:hover :global(svg) {
		color: var(--ink);
	}
	.cta {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 40px;
	}
	@media (max-width: 820px) {
		.about {
			grid-template-columns: 1fr;
		}
		.portrait {
			position: static;
			max-width: 360px;
		}
	}
</style>
