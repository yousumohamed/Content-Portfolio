export type MediaKind = 'image' | 'video';
export type PostStatus = 'draft' | 'published';

export interface Category {
	id: string;
	name: string;
	slug: string;
	position: number;
}

export interface ProfileLinks {
	instagram?: string;
	youtube?: string;
	tiktok?: string;
	x?: string;
	behance?: string;
	website?: string;
}

export interface Profile {
	name: string;
	headline: string;
	bio: string;
	location: string;
	email: string;
	avatar_path: string | null;
	links: ProfileLinks;
}

export interface Media {
	id: string;
	post_id: string;
	kind: MediaKind;
	path: string;
	poster_path: string | null;
	thumb_path: string | null;
	mime: string | null;
	size_bytes: number | null;
	width: number | null;
	height: number | null;
	duration: number | null;
	alt: string;
	position: number;
}

/** Lightweight shape used in feeds / grids. */
export interface FeedPost {
	id: string;
	slug: string;
	title: string;
	cover_kind: MediaKind | null;
	cover_path: string | null;
	cover_thumb_path: string | null;
	cover_duration: number | null;
	cover_width: number | null;
	cover_height: number | null;
	media_count: number;
	views: number;
	likes: number;
	pinned: boolean;
	published_at: string | null;
	category: Pick<Category, 'name' | 'slug'> | null;
}

export interface Post extends FeedPost {
	description: string;
	tags: string[];
	status: PostStatus;
	category_id: string | null;
	created_at: string;
	updated_at: string;
	media: Media[];
}
