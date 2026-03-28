import { ApifyClient } from 'apify-client';
import type { Post, PipelineConfig } from './types.js';

const IG_ACCOUNTS = ['yta.ron', 'jguappo', '8ball', 'brezscales', 'samm_zia'];
const TT_ACCOUNTS = ['yta.ron'];

function log(msg: string) {
    console.log(`[scraper] ${msg}`);
}

async function runActor(
    client: ApifyClient,
    actorId: string,
    input: Record<string, unknown>,
    label: string,
): Promise<Record<string, unknown>[]> {
    log(`Starting ${label}...`);
    const run = await client.actor(actorId).call(input, { waitSecs: 300 });

    if (run.status !== 'SUCCEEDED') {
        throw new Error(`Actor ${actorId} ${run.status}`);
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    log(`${label}: got ${items.length} items`);
    return items as Record<string, unknown>[];
}

export async function scrapeInstagram(config: PipelineConfig): Promise<Post[]> {
    const client = new ApifyClient({ token: config.apifyKey });
    const posts: Post[] = [];

    for (const account of IG_ACCOUNTS) {
        try {
            const items = await runActor(
                client,
                'apify/instagram-reel-scraper',
                {
                    username: [account],
                    resultsLimit: config.postsPerAccount,
                },
                `IG @${account}`,
            );

            for (const item of items) {
                const music = item.musicInfo as Record<string, unknown> | null;
                posts.push({
                    id: String(item.id ?? item.shortCode ?? Math.random()),
                    platform: 'instagram',
                    account,
                    url: String(item.url ?? item.displayUrl ?? ''),
                    caption: String(item.caption ?? ''),
                    views: Number(item.videoViewCount ?? item.videoPlayCount ?? 0),
                    likes: Number(item.likesCount ?? 0),
                    comments: Number(item.commentsCount ?? 0),
                    shares: 0,
                    audio: music ? String(music.songName ?? '') : null,
                    audioArtist: music ? String(music.artistName ?? '') : null,
                    duration: Number(item.videoDuration ?? 0) || null,
                    timestamp: String(item.timestamp ?? ''),
                    thumbnailUrl: String(item.displayUrl ?? item.thumbnailSrc ?? ''),
                    thumbnailPath: null,
                    visionAnalysis: null,
                });
            }
        } catch (err) {
            log(`❌ IG @${account} failed: ${(err as Error).message}`);
        }
    }

    return posts;
}

export async function scrapeTikTok(config: PipelineConfig): Promise<Post[]> {
    const client = new ApifyClient({ token: config.apifyKey });
    const posts: Post[] = [];

    for (const account of TT_ACCOUNTS) {
        try {
            const items = await runActor(
                client,
                'clockworks/tiktok-scraper',
                {
                    profiles: [`https://www.tiktok.com/@${account}`],
                    resultsPerPage: config.postsPerAccount,
                    shouldDownloadCovers: false,
                    shouldDownloadVideos: false,
                },
                `TT @${account}`,
            );

            for (const item of items) {
                const music = item.musicMeta as Record<string, unknown> | null;
                const covers = item.covers as Record<string, unknown> | null;
                posts.push({
                    id: String(item.id ?? Math.random()),
                    platform: 'tiktok',
                    account,
                    url: String(item.webVideoUrl ?? ''),
                    caption: String(item.text ?? ''),
                    views: Number(item.playCount ?? 0),
                    likes: Number(item.diggCount ?? 0),
                    comments: Number(item.commentCount ?? 0),
                    shares: Number(item.shareCount ?? 0),
                    audio: music ? String(music.musicName ?? '') : null,
                    audioArtist: music ? String(music.musicAuthor ?? '') : null,
                    duration: Number(item.videoMeta ? (item.videoMeta as Record<string, unknown>).duration : 0) || null,
                    timestamp: String(item.createTimeISO ?? ''),
                    thumbnailUrl: covers ? String(covers.default ?? '') : null,
                    thumbnailPath: null,
                    visionAnalysis: null,
                });
            }
        } catch (err) {
            log(`❌ TT @${account} failed: ${(err as Error).message}`);
        }
    }

    return posts;
}

export async function scrapeAll(config: PipelineConfig): Promise<Post[]> {
    log('Starting scrape...');
    const [igPosts, ttPosts] = await Promise.all([
        scrapeInstagram(config),
        scrapeTikTok(config),
    ]);
    const all = [...igPosts, ...ttPosts];
    log(`Total: ${all.length} posts scraped`);
    return all;
}

// DRY RUN — returns mock data to test the rest of the pipeline
export function mockPosts(): Post[] {
    return [
        {
            id: 'ig_ron_1',
            platform: 'instagram',
            account: 'yta.ron',
            url: 'https://instagram.com/p/mock1',
            caption: 'thanks mcdonalds for this',
            views: 3000000,
            likes: 45000,
            comments: 1200,
            shares: 8900,
            audio: 'Starboy',
            audioArtist: 'The Weeknd',
            duration: 9,
            timestamp: '2025-03-10T20:00:00Z',
            thumbnailUrl: null,
            thumbnailPath: null,
            visionAnalysis: null,
        },
        {
            id: 'ig_ron_2',
            platform: 'instagram',
            account: 'yta.ron',
            url: 'https://instagram.com/p/mock2',
            caption: '2016 canada larp',
            views: 248000,
            likes: 12000,
            comments: 430,
            shares: 1800,
            audio: 'Passionfruit',
            audioArtist: 'Drake',
            duration: 15,
            timestamp: '2025-03-17T20:00:00Z',
            thumbnailUrl: null,
            thumbnailPath: null,
            visionAnalysis: null,
        },
        {
            id: 'ig_ron_3',
            platform: 'instagram',
            account: 'yta.ron',
            url: 'https://instagram.com/p/mock3',
            caption: 'when every choice you make is deciding your fate...',
            views: 1000,
            likes: 42,
            comments: 3,
            shares: 0,
            audio: 'ambient',
            audioArtist: null,
            duration: 12,
            timestamp: '2025-03-20T20:00:00Z',
            thumbnailUrl: null,
            thumbnailPath: null,
            visionAnalysis: null,
        },
        {
            id: 'ig_8ball_1',
            platform: 'instagram',
            account: '8ball',
            url: 'https://instagram.com/p/mock4',
            caption: 'my circle so small when phone rings ik its scammers',
            views: 890000,
            likes: 32000,
            comments: 2100,
            shares: 14000,
            audio: 'Rich Flex',
            audioArtist: 'Drake',
            duration: 7,
            timestamp: '2025-03-18T20:00:00Z',
            thumbnailUrl: null,
            thumbnailPath: null,
            visionAnalysis: null,
        },
        {
            id: 'ig_jguappo_1',
            platform: 'instagram',
            account: 'jguappo',
            url: 'https://instagram.com/p/mock5',
            caption: 'its a what if everything genuinely works out type year fr',
            views: 2100000,
            likes: 78000,
            comments: 3400,
            shares: 22000,
            audio: 'Sweets',
            audioArtist: 'isaintjames',
            duration: 18,
            timestamp: '2025-03-15T20:00:00Z',
            thumbnailUrl: null,
            thumbnailPath: null,
            visionAnalysis: null,
        },
        {
            id: 'ig_brezscale_1',
            platform: 'instagram',
            account: 'brezscales',
            url: 'https://instagram.com/p/mock6',
            caption: 'everything lined up',
            views: 180000,
            likes: 9800,
            comments: 340,
            shares: 2100,
            audio: 'Midnight Rain',
            audioArtist: null,
            duration: 11,
            timestamp: '2025-03-19T20:00:00Z',
            thumbnailUrl: null,
            thumbnailPath: null,
            visionAnalysis: null,
        },
    ];
}
