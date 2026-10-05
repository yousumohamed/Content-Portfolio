import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedPost, Post } from './types';

export const PAGE_SIZE = 24;

export const FEED_COLUMNS =
	'id, slug, title, cover_kind, cover_path, cover_thumb_path, cover_duration, cover_width, cover_height, media_count, views, likes, pinned, published_at, category:gallery_categories(name, slug)';

export type FeedSort = 'latest' | 'popular' | 'liked';

export interface FeedQuery {
	type?: 'image' | 'video' | null;
	categoryId?: string | null;
	tag?: string | null;
	q?: string | null;
	sort?: FeedSort;
	offset?: number;
	limit?: number;
	excludeId?: string;
}

/** Strip characters that have meaning inside PostgREST filter strings. */
const sanitize = (s: string) => s.replace(/[%,()*\:"']/g, ' ').replace(/\s+/g, ' ').trim();

export async function fetchFeed(supabase: SupabaseClient, opts: FeedQuery = {}) {
	const { offset = 0, limit = PAGE_SIZE, sort = 'latest' } = opts;

	let query = supabase
		.from('gallery_posts')
		.select(FEED_COLUMNS)
		.eq('status', 'published')
		.gt('media_count', 0);

	if (opts.type) query = query.eq('cover_kind', opts.type);
	if (opts.categoryId) query = query.eq('category_id', opts.categoryId);
	if (opts.tag) query = query.contains('tags', [opts.tag]);
	if (opts.excludeId) query = query.neq('id', opts.excludeId);
	if (opts.q) {
		const s = sanitize(opts.q);
		if (s) query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
	}

	if (sort === 'popular') query = query.order('views', { ascending: false });
	else if (sort === 'liked') query = query.order('likes', { ascending: false });
	else query = query.order('pinned', { ascending: false });

	query = query.order('published_at', { ascending: false, nullsFirst: false }).range(offset, offset + limit - 1);

	const { data, error } = await query;
	if (error) {
		console.error('[feed]', error.message);
		return { posts: [] as FeedPost[], error: error.message, hasMore: false };
	}
	const posts = (data ?? []) as unknown as FeedPost[];
	return { posts, error: null, hasMore: posts.length === limit };
}

export const POST_COLUMNS = `*, category:gallery_categories(name, slug), media:gallery_media(*)`;

export async function fetchPost(supabase: SupabaseClient, slug: string) {
	const { data, error } = await supabase
		.from('gallery_posts')
		.select(POST_COLUMNS)
		.eq('slug', slug)
		.maybeSingle();
	if (error) console.error('[post]', error.message);
	const post = (data as Post | null) ?? null;
	post?.media.sort((a, b) => a.position - b.position);
	return post;
}
