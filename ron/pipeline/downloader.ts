import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { Post } from './types.js';

function log(msg: string) {
    console.log(`[downloader] ${msg}`);
}

function safeName(account: string, id: string): string {
    return `${account}_${id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function downloadOne(url: string, destPath: string): Promise<boolean> {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' },
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            log(`  HTTP ${res.status} for ${url.slice(0, 60)}`);
            return false;
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        await writeFile(destPath, buffer);
        return true;
    } catch (err) {
        log(`  Failed: ${(err as Error).message}`);
        return false;
    }
}

export async function downloadThumbnails(posts: Post[], thumbnailDir: string): Promise<Post[]> {
    await mkdir(thumbnailDir, { recursive: true });

    log(`Downloading ${posts.length} thumbnails to ${thumbnailDir}`);

    const results = await Promise.allSettled(
        posts.map(async (post) => {
            if (!post.thumbnailUrl) {
                log(`  Skipping ${post.account}_${post.id} — no thumbnail URL`);
                return post;
            }

            const filename = `${safeName(post.account, post.id)}.jpg`;
            const destPath = join(thumbnailDir, filename);

            const ok = await downloadOne(post.thumbnailUrl, destPath);

            return {
                ...post,
                thumbnailPath: ok ? destPath : null,
            };
        }),
    );

    const updated: Post[] = [];
    let downloaded = 0;
    let failed = 0;

    for (const result of results) {
        if (result.status === 'fulfilled') {
            updated.push(result.value);
            if (result.value.thumbnailPath) downloaded++;
        } else {
            failed++;
        }
    }

    log(`Downloaded: ${downloaded} | Failed/skipped: ${failed}`);
    return updated;
}
