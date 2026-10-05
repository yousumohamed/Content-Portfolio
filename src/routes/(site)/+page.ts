import { fetchFeed, type FeedQuery, type FeedSort } from '#lib/feed.ts';
import type { PageLoad } from './$types';

const SORTS: FeedSort[] = ['latest', 'popular', 'liked'];

export const load: PageLoad = async ({ parent, url }) => {
	const { supabase, categories } = await parent();
	const sp = url.searchParams;

	const typeParam = sp.get('type');
	const type: FeedQuery['type'] = typeParam === 'image' || typeParam === 'video' ? typeParam : null;
	const category = categories.find((c) => c.slug === sp.get('c')) ?? null;
	const sortParam = sp.get('sort') as FeedSort | null;
	const sort: FeedSort = sortParam && SORTS.includes(sortParam) ? sortParam : 'latest';
	const q = sp.get('q')?.trim() || null;
	const tag = sp.get('tag')?.trim() || null;

	const filters = { type, categoryId: category?.id ?? null, q, tag, sort };
	const feed = await fetchFeed(supabase, filters);

	return {
		...feed,
		filters,
		activeCategory: category
	};
};
