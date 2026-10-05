import type { FeedPost, PostStatus } from '#lib/types.ts';
import type { PageLoad } from './$types';

export type AdminPost = FeedPost & {
	status: PostStatus;
	updated_at: string;
	tags: string[];
};

export const load: PageLoad = async ({ parent, depends }) => {
	depends('admin:posts');
	const { supabase } = await parent();

	const { data, error } = await supabase
		.from('gallery_posts')
		.select(
			'id, slug, title, status, tags, pinned, views, likes, media_count, cover_kind, cover_path, cover_thumb_path, cover_duration, cover_width, cover_height, published_at, updated_at, category:gallery_categories(name, slug)'
		)
		.order('updated_at', { ascending: false });

	return { posts: (data ?? []) as unknown as AdminPost[], error: error?.message ?? null };
};
