import type { SupabaseClient } from '@supabase/supabase-js';
import { BUCKET } from './media';

/** Remove objects from the gallery bucket; ignores empty paths. */
export async function removeObjects(supabase: SupabaseClient, paths: (string | null | undefined)[]) {
	const clean = paths.filter((p): p is string => Boolean(p));
	if (!clean.length) return;
	const { error } = await supabase.storage.from(BUCKET).remove(clean);
	if (error) console.warn('[storage] remove failed', error.message);
}

/** Delete a post, its media rows (cascade) and every stored file under it. */
export async function deletePost(supabase: SupabaseClient, postId: string) {
	const { data: media } = await supabase
		.from('gallery_media')
		.select('path, thumb_path, poster_path')
		.eq('post_id', postId);

	const { error } = await supabase.from('gallery_posts').delete().eq('id', postId);
	if (error) throw new Error(error.message);

	await removeObjects(
		supabase,
		(media ?? []).flatMap((m) => [m.path, m.thumb_path, m.poster_path])
	);
}

export async function accessToken(supabase: SupabaseClient) {
	const { data } = await supabase.auth.getSession();
	const token = data.session?.access_token;
	if (!token) throw new Error('Your session expired — please sign in again');
	return token;
}
