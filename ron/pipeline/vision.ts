import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { Post } from './types.js';

const VISION_PROMPT = `Describe this social media video thumbnail. Answer each of these:
1. What text is visible on screen (exact words)?
2. What is the visual setting (indoor/outdoor, location type, time of day)?
3. What is the person doing or their posture/expression?
4. What props or items are visible (cars, phones, laptops, clothing, etc.)?
5. What is the overall aesthetic (dark/moody, bright/clean, lo-fi, luxury, etc.)?
6. What emotion or vibe does this thumbnail communicate instantly?

Be specific and concise. This is for content strategy analysis.`;

function log(msg: string) {
    console.log(`[vision] ${msg}`);
}

async function analyzeOne(client: Anthropic, post: Post): Promise<string> {
    // Use local file if downloaded, otherwise skip
    if (!post.thumbnailPath || !existsSync(post.thumbnailPath)) {
        return 'No thumbnail available for analysis.';
    }

    const imageData = await readFile(post.thumbnailPath);
    const base64 = imageData.toString('base64');

    const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: 'image/jpeg',
                            data: base64,
                        },
                    },
                    {
                        type: 'text',
                        text: VISION_PROMPT,
                    },
                ],
            },
        ],
    });

    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
}

export async function analyzeWithVision(posts: Post[], anthropicKey: string): Promise<Post[]> {
    const client = new Anthropic({ apiKey: anthropicKey });
    const withThumbnails = posts.filter((p) => p.thumbnailPath && existsSync(p.thumbnailPath));

    log(`Analyzing ${withThumbnails.length} thumbnails with vision (skipping ${posts.length - withThumbnails.length} without images)`);

    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    const updatedMap = new Map(posts.map((p) => [p.id, p]));

    for (let i = 0; i < withThumbnails.length; i += batchSize) {
        const batch = withThumbnails.slice(i, i + batchSize);
        log(`  Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(withThumbnails.length / batchSize)}...`);

        const results = await Promise.allSettled(
            batch.map(async (post) => {
                const analysis = await analyzeOne(client, post);
                return { id: post.id, analysis };
            }),
        );

        for (const result of results) {
            if (result.status === 'fulfilled') {
                const existing = updatedMap.get(result.value.id);
                if (existing) {
                    updatedMap.set(result.value.id, {
                        ...existing,
                        visionAnalysis: result.value.analysis,
                    });
                }
            }
        }

        // Small pause between batches
        if (i + batchSize < withThumbnails.length) {
            await new Promise((r) => setTimeout(r, 1000));
        }
    }

    log(`Vision analysis complete`);
    return Array.from(updatedMap.values());
}

// For dry run: generate mock vision output
export function mockVisionAnalysis(posts: Post[]): Post[] {
    return posts.map((post) => ({
        ...post,
        visionAnalysis: `[DRY RUN] Setting: ${post.platform === 'instagram' ? 'Outdoor city night, M4 visible' : 'Indoor dark room'}. Text: "${post.caption.slice(0, 30)}". Aesthetic: ${post.views > 500000 ? 'High contrast, luxury' : 'Casual, lo-fi'}. Vibe: ${post.views > 500000 ? 'Aspirational confidence' : 'Reflective, understated'}.`,
    }));
}
