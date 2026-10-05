/**
 * In-browser video compression (WebCodecs via Mediabunny) so large videos fit
 * under the Supabase per-file upload limit. Loaded lazily — only the admin
 * pays for it, and only when a video is actually too big.
 */

export interface CompressResult {
	file: File;
	width: number;
	height: number;
	duration: number;
}

const AUDIO_BUDGET = 160_000; // bits/s reserved for the audio track
const MAX_VIDEO_BITRATE = 8_000_000;

export async function compressVideo(
	file: File,
	targetBytes: number,
	onProgress?: (fraction: number) => void
): Promise<CompressResult> {
	const mb = await import('mediabunny');

	const run = async (budgetBytes: number) => {
		const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) });
		const track = await input.getPrimaryVideoTrack();
		if (!track) throw new Error('No video track found in this file');

		const duration = Math.max(1, await input.computeDuration());
		const srcW = await track.getDisplayWidth();
		const srcH = await track.getDisplayHeight();

		// Spend the size budget on video bitrate, then pick a resolution that suits it.
		const totalBitrate = (budgetBytes * 8) / duration;
		const videoBitrate = Math.round(Math.min(MAX_VIDEO_BITRATE, Math.max(300_000, totalBitrate - AUDIO_BUDGET)));
		const longEdge = videoBitrate >= 2_500_000 ? 1920 : videoBitrate >= 1_200_000 ? 1280 : 854;
		const scale = Math.min(1, longEdge / Math.max(srcW, srcH));
		const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
		const width = even(srcW * scale);
		const height = even(srcH * scale);

		const codec = await mb.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], {
			width,
			height,
			bitrate: videoBitrate
		});
		if (!codec) throw new Error('This browser cannot encode video — try the latest Chrome or Edge');

		const output = new mb.Output({
			format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }),
			target: new mb.BufferTarget()
		});

		const conversion = await mb.Conversion.init({
			input,
			output,
			tracks: 'primary',
			video: {
				width,
				height,
				fit: 'contain',
				codec,
				quality: new mb.Quality({ bitrate: videoBitrate }),
				forceTranscode: true
			},
			audio: { quality: new mb.Quality({ bitrate: 128_000 }) }
		});

		if (!conversion.isValid) {
			const reasons = conversion.discardedTracks.map((d) => `${d.track.type}: ${d.reason}`).join(', ');
			throw new Error(`Cannot convert this video (${reasons || 'unsupported format'})`);
		}
		if (conversion.discardedTracks.some((d) => d.track.type === 'audio')) {
			console.warn('[compress] audio track dropped', conversion.discardedTracks);
		}

		conversion.onProgress = (p) => onProgress?.(p);
		await conversion.execute();

		const buffer = output.target.buffer;
		if (!buffer) throw new Error('Video compression produced no output');
		const name = file.name.replace(/\.[^.]+$/, '') + '.mp4';
		return { file: new File([buffer], name, { type: 'video/mp4' }), width, height, duration };
	};

	let result = await run(targetBytes);
	// Encoders don't hit bitrates exactly — one tighter retry if we overshot.
	if (result.file.size > targetBytes / 0.92) {
		onProgress?.(0);
		result = await run(targetBytes * 0.75);
	}
	return result;
}
