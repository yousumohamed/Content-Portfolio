import { PUBLIC_SUPABASE_URL } from '$app/env/public';

export const BUCKET = 'gallery';

/** Public URL for an object in the gallery bucket. */
export function publicUrl(path: string | null | undefined): string {
	if (!path) return '';
	if (/^https?:\/\//.test(path)) return path;
	const clean = path.split('/').map(encodeURIComponent).join('/');
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${clean}`;
}

export function formatDuration(seconds: number | null | undefined): string {
	if (!seconds || !isFinite(seconds)) return '';
	const s = Math.round(seconds);
	const m = Math.floor(s / 60);
	const h = Math.floor(m / 60);
	const pad = (n: number) => String(n).padStart(2, '0');
	return h ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

export function formatBytes(bytes: number | null | undefined): string {
	if (!bytes) return '';
	const units = ['B', 'KB', 'MB', 'GB'];
	let i = 0;
	let n = bytes;
	while (n >= 1024 && i < units.length - 1) {
		n /= 1024;
		i++;
	}
	return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Height / width ratio, with a sensible portrait-ish fallback. */
export function ratioOf(w: number | null | undefined, h: number | null | undefined): number {
	if (!w || !h) return 1.25;
	return Math.min(Math.max(h / w, 0.4), 2.4);
}
