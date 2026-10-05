import { error } from '@sveltejs/kit';
import { POST_COLUMNS } from '#lib/feed.ts';
import type { Category, Post } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, params }) => {
	const { supabase } = await parent();

	const [postRes, catRes] = await Promise.all([
		supabase.from('gallery_posts').select(POST_COLUMNS).eq('id', params.id).maybeSingle(),
		supabase.from('gallery_categories').select('*').order('position').order('name')
	]);

	const post = postRes.data as Post | null;
	if (!post) error(404, 'Post not found');
	post.media.sort((a, b) => a.position - b.position);

	return { post, categories: (catRes.data ?? []) as Category[] };
};
