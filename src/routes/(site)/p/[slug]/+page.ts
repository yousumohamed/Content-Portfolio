import { error } from '@sveltejs/kit';
import { fetchFeed, fetchPost } from '#lib/feed.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, params }) => {
	const { supabase } = await parent();

	const post = await fetchPost(supabase, params.slug);
	if (!post || post.status !== 'published') error(404, 'This project could not be found');

	// Related: same category first, topped up with latest work.
	let { posts: related } = await fetchFeed(supabase, {
		categoryId: post.category_id,
		excludeId: post.id,
		limit: 12
	});
	if (related.length < 8) {
		const more = await fetchFeed(supabase, { excludeId: post.id, limit: 12 });
		const seen = new Set(related.map((p) => p.id));
		related = [...related, ...more.posts.filter((p) => !seen.has(p.id))].slice(0, 12);
	}

	return { post, related };
};
