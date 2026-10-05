import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$app/env/public';
import { BUCKET } from './media';
import type { MediaKind } from './types';

export const THUMB_WIDTH = 900;
export const POSTER_WIDTH = 1920;

export interface PreparedFile {
	kind: MediaKind;
	width: number | null;
	height: number | null;
	duration: number | null;
	/** small preview image used in grids */
	thumb: Blob | null;
	/** full-size still frame for videos */
	poster: Blob | null;
}

export function kindOf(file: File): MediaKind | null {
	if (file.type.startsWith('image/')) return 'image';
	if (file.type.startsWith('video/')) return 'video';
	return null;
}

export function extOf(file: File | Blob, fallback = 'bin') {
	if (file instanceof File) {
		const m = /\.([a-z0-9]{1,6})$/i.exec(file.name);
		if (m) return m[1].toLowerCase();
	}
	const sub = file.type.split('/')[1]?.replace('jpeg', 'jpg').replace('quicktime', 'mov');
	return sub?.replace(/[^a-z0-9]/gi, '') || fallback;
}

function loadImage(src: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.decoding = 'async';
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('Could not read image'));
		img.src = src;
	});
}

function once<K extends keyof HTMLVideoElementEventMap>(el: HTMLVideoElement, event: K, ms = 15000) {
	return new Promise<void>((resolve, reject) => {
		const t = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), ms);
		el.addEventListener(
			event,
			() => {
				clearTimeout(t);
				resolve();
			},
			{ once: true }
		);
		el.addEventListener(
			'error',
			() => {
				clearTimeout(t);
				reject(new Error('This video format cannot be previewed in the browser'));
			},
			{ once: true }
		);
	});
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
	return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Draw a source into a canvas at most `maxW` wide and encode as WebP (JPEG fallback for Safari). */
export async function rasterize(source: CanvasImageSource, srcW: number, srcH: number, maxW: number) {
	const w = Math.min(maxW, srcW);
	const h = Math.round((srcH * w) / srcW);
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(source, 0, 0, w, h);
	const webp = await canvasToBlob(canvas, 'image/webp', 0.82);
	if (webp && webp.type === 'image/webp') return webp;
	return canvasToBlob(canvas, 'image/jpeg', 0.85);
}

/** Read dimensions and build thumbnails / posters entirely in the browser. */
export async function prepareFile(file: File): Promise<PreparedFile> {
	const kind = kindOf(file);
	if (!kind) throw new Error('Only images and videos are supported');
	const url = URL.createObjectURL(file);

	try {
		if (kind === 'image') {
			const img = await loadImage(url);
			const width = img.naturalWidth || null;
			const height = img.naturalHeight || null;
			// Keep GIF animation / SVG crispness: the original is used as its own thumb.
			const skipThumb = /gif|svg/.test(file.type) || !width || !height || width <= THUMB_WIDTH;
			const thumb = skipThumb ? null : await rasterize(img, width, height, THUMB_WIDTH);
			return { kind, width, height, duration: null, thumb, poster: null };
		}

		const video = document.createElement('video');
		video.muted = true;
		video.playsInline = true;
		video.preload = 'auto';
		video.src = url;
		await once(video, 'loadeddata');
		const width = video.videoWidth || null;
		const height = video.videoHeight || null;
		const duration = isFinite(video.duration) ? video.duration : null;

		let thumb: Blob | null = null;
		let poster: Blob | null = null;
		if (width && height) {
			video.currentTime = Math.min(1, (duration ?? 2) * 0.1);
			await once(video, 'seeked').catch(() => {});
			poster = await rasterize(video, width, height, POSTER_WIDTH);
			thumb = await rasterize(video, width, height, THUMB_WIDTH);
		}
		video.removeAttribute('src');
		video.load();
		return { kind, width, height, duration, thumb, poster };
	} finally {
		URL.revokeObjectURL(url);
	}
}

/**
 * Upload straight from the browser to Supabase Storage with progress events.
 * Row Level Security on the bucket only allows admins to write.
 */
export function uploadObject(opts: {
	path: string;
	body: Blob;
	token: string;
	onProgress?: (fraction: number) => void;
}): Promise<void> {
	const { path, body, token, onProgress } = opts;
	const encoded = path.split('/').map(encodeURIComponent).join('/');

	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('POST', `${PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${encoded}`);
		xhr.setRequestHeader('Authorization', `Bearer ${token}`);
		xhr.setRequestHeader('apikey', PUBLIC_SUPABASE_ANON_KEY);
		xhr.setRequestHeader('x-upsert', 'true');
		xhr.setRequestHeader('cache-control', 'max-age=31536000');
		xhr.setRequestHeader('Content-Type', body.type || 'application/octet-stream');

		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress?.(e.loaded / e.total);
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) return resolve();
			let message = `Upload failed (${xhr.status})`;
			try {
				const res = JSON.parse(xhr.responseText);
				message = res.message || res.error || message;
			} catch {
				/* not JSON */
			}
			if (xhr.status === 413 || /maximum allowed size|too large/i.test(message)) {
				message = 'File is larger than your Supabase upload limit (Storage → Settings)';
			}
			reject(new Error(message));
		};
		xhr.onerror = () => reject(new Error('Network error during upload'));
		xhr.send(body);
	});
}
