import Anthropic from '@anthropic-ai/sdk';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { Post } from './types.js';

function log(msg: string) {
    console.log(`[report] ${msg}`);
}

function engagementRate(post: Post): number {
    if (!post.views || post.views === 0) return 0;
    return ((post.likes + post.comments + post.shares) / post.views) * 100;
}

function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return String(n);
}

function buildDataSummary(posts: Post[]): string {
    const ronPosts = posts.filter((p) => p.account === 'yta.ron').sort((a, b) => b.views - a.views);
    const competitorPosts = posts.filter((p) => p.account !== 'yta.ron');

    const ronSection = ronPosts
        .map(
            (p, i) =>
                `${i + 1}. [${formatNumber(p.views)} views | ${formatNumber(p.likes)} likes | ER: ${engagementRate(p).toFixed(2)}%]
   Caption: "${p.caption.slice(0, 120)}"
   Audio: ${p.audio ? `${p.audio} by ${p.audioArtist ?? 'unknown'}` : 'none'}
   Duration: ${p.duration ?? '?'}s | Platform: ${p.platform}
   Visual: ${p.visionAnalysis ?? 'no analysis'}`,
        )
        .join('\n\n');

    const compSection = Object.entries(
        competitorPosts.reduce<Record<string, Post[]>>((acc, p) => {
            if (!acc[p.account]) acc[p.account] = [];
            acc[p.account].push(p);
            return acc;
        }, {}),
    )
        .map(([account, acctPosts]) => {
            const sorted = acctPosts.sort((a, b) => b.views - a.views).slice(0, 3);
            return `@${account}:\n${sorted
                .map(
                    (p) =>
                        `  - ${formatNumber(p.views)} views | "${p.caption.slice(0, 80)}" | audio: ${p.audio ?? 'n/a'}
    Visual: ${p.visionAnalysis?.slice(0, 150) ?? 'no analysis'}`,
                )
                .join('\n')}`;
        })
        .join('\n\n');

    const audioFreq = posts
        .filter((p) => p.audio)
        .reduce<Record<string, number>>((acc, p) => {
            const key = `${p.audio} - ${p.audioArtist ?? 'unknown'}`;
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        }, {});

    const topAudios = Object.entries(audioFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([audio, count]) => `  ${count}x ${audio}`)
        .join('\n');

    return `=== RON'S POSTS (sorted by views) ===
${ronSection}

=== COMPETITOR TOP POSTS ===
${compSection}

=== AUDIO FREQUENCY ===
${topAudios}`;
}

export async function generateReport(posts: Post[], anthropicKey: string, outputDir: string): Promise<string> {
    log('Generating weekly brief with Claude...');

    const client = new Anthropic({ apiKey: anthropicKey });
    const dataSummary = buildDataSummary(posts);
    const weekDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const prompt = `You are the AI COO for @yta.ron, a 19-year-old content creator building a personal brand around YouTube automation (YTA), an M4, and internet culture. His brand is: relatable, funny, self-aware, internet-native, "unemployed but winning."

Here is this week's scraped social media data:

${dataSummary}

Generate a weekly_brief.md with EXACTLY this structure:

# Weekly Content Brief — ${weekDate}

## Ron's Performance This Week

### Top 3 Posts
[List top 3 by views with: views, what worked and why, what to replicate]

### Bottom 3 Posts
[List bottom 3 by views with: views, what flopped and why, what to avoid]

## Competitor Formats Winning This Week
[For each competitor with notable posts: what format/caption style is working, what Ron can adapt]

## Top 5 Content Ideas for Ron This Week
[5 specific, ready-to-execute ideas based on patterns. For each include:]
- **Idea**: [short name]
- **Format**: [what to film/how]
- **Caption**: [exact caption to use]
- **Audio**: [specific audio or type to use]
- **Why it'll hit**: [1 sentence reason based on data]

## Audio Trends
[Which audios are appearing across accounts, which are rising, which to use this week]

## Quick Wins (do these today)
[2-3 immediate actions based on what's hot right now]

Be specific, data-driven, and write in a direct tone. No fluff. Ron reads this Monday morning and executes it that week.`;

    const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
    });

    const block = response.content[0];
    const brief = block.type === 'text' ? block.text : '';

    const outputPath = join(outputDir, 'weekly_brief.md');
    await writeFile(outputPath, brief);
    log(`Brief saved to ${outputPath}`);

    return brief;
}

// Dry run version — skips Claude API call, generates a templated brief
export async function generateDryRunReport(posts: Post[], outputDir: string): Promise<string> {
    log('Generating DRY RUN brief (no API call)...');

    const ronPosts = posts.filter((p) => p.account === 'yta.ron').sort((a, b) => b.views - a.views);
    const top3 = ronPosts.slice(0, 3);
    const bottom3 = ronPosts.slice(-3).reverse();
    const weekDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const topAudios = posts
        .filter((p) => p.audio)
        .reduce<Record<string, number>>((acc, p) => {
            const key = `${p.audio} — ${p.audioArtist ?? 'unknown'}`;
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        }, {});

    const audioList = Object.entries(topAudios)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([audio, count]) => `- **${audio}** (used ${count}x across accounts)`)
        .join('\n');

    const brief = `# Weekly Content Brief — ${weekDate}
> ⚠️ DRY RUN — Set ANTHROPIC_KEY for AI-generated analysis

## Ron's Performance This Week

### Top 3 Posts
${top3.map((p, i) => `${i + 1}. **${formatNumber(p.views)} views** — "${p.caption.slice(0, 80)}"
   - ER: ${engagementRate(p).toFixed(2)}% | Audio: ${p.audio ?? 'none'}
   - Vision: ${p.visionAnalysis?.slice(0, 100) ?? 'no analysis'}`).join('\n\n')}

### Bottom 3 Posts
${bottom3.map((p, i) => `${i + 1}. **${formatNumber(p.views)} views** — "${p.caption.slice(0, 80)}"
   - ER: ${engagementRate(p).toFixed(2)}% | Audio: ${p.audio ?? 'none'}`).join('\n\n')}

## Competitor Formats Winning This Week
${posts
    .filter((p) => p.account !== 'yta.ron')
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((p) => `- **@${p.account}** — ${formatNumber(p.views)} views: "${p.caption.slice(0, 80)}"`)
    .join('\n')}

## Top 5 Content Ideas for Ron This Week

1. **Ironic Credit** — replicate McDonald's formula
   - Caption: \`thanks [random thing] for this\`
   - Audio: trending under 10k uses
   - Why: proven 3M formula

2. **Nostalgia Bait** — 2016 identity post
   - Caption: \`2016 me wouldn't believe this\`
   - Audio: 2016-era song
   - Why: proven 248k formula

3. **Confusing Status** — pattern interrupt
   - Caption: \`mysterious source of income and posting obscure storys on social media\`
   - Audio: bitcrushed EDM
   - Why: 8ball-style caption performs best for small accounts

4. **jguappo format** — "type year" caption + still image collage
   - Caption: \`its a what if everything genuinely works out type year fr\`
   - Audio: Sweets by isaintjames
   - Why: jguappo's top performer this week

5. **Dark room rant** — Aldo/retardroas style
   - Caption: \`nothing teaches you faster than being stupid twice\`
   - Audio: underground ambient
   - Why: face content = algorithm boost + personality builds follows

## Audio Trends
${audioList}

## Quick Wins (do these today)
- Post the "type year" still image collage — lowest effort, highest ceiling right now
- Reply to 5 comments on the 248k video to restart its algorithm cycle
- Screenshot your best analytics and queue a "the laptop paid for it" post for Tuesday 7pm
`;

    const outputPath = join(outputDir, 'weekly_brief.md');
    await writeFile(outputPath, brief);
    log(`Dry run brief saved to ${outputPath}`);

    return brief;
}
