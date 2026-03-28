/**
 * RON CONTENT INTELLIGENCE PIPELINE
 *
 * Full run:
 *   APIFY_KEY=xxx ANTHROPIC_KEY=xxx npx tsx ron/pipeline/index.ts
 *
 * Dry run (no API calls, uses mock data):
 *   npx tsx ron/pipeline/index.ts --dry-run
 *
 * Output: ron/weekly_brief.md
 */

import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { scrapeAll, mockPosts } from './scraper.js';
import { downloadThumbnails } from './downloader.js';
import { analyzeWithVision, mockVisionAnalysis } from './vision.js';
import { generateReport, generateDryRunReport } from './report.js';
import type { Post, PipelineConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DATA_PATH = join(ROOT, 'data', 'posts.json');
const THUMBNAIL_DIR = join(ROOT, 'thumbnails');
const OUTPUT_DIR = ROOT;

function banner(msg: string) {
    const line = '═'.repeat(50);
    console.log(`\n${line}`);
    console.log(`  ${msg}`);
    console.log(`${line}\n`);
}

async function savePosts(posts: Post[]): Promise<void> {
    await writeFile(DATA_PATH, JSON.stringify(posts, null, 2));
}

async function loadPosts(): Promise<Post[] | null> {
    if (!existsSync(DATA_PATH)) return null;
    return JSON.parse(await readFile(DATA_PATH, 'utf-8')) as Post[];
}

async function run(config: PipelineConfig): Promise<void> {
    const startTime = Date.now();
    banner(`RON PIPELINE — ${config.dryRun ? 'DRY RUN' : 'LIVE'}`);

    // STEP 1: SCRAPE
    banner('Step 1/4: Scraping posts');
    let posts: Post[];

    if (config.dryRun) {
        console.log('  Using mock data (--dry-run mode)');
        posts = mockPosts();
    } else {
        posts = await scrapeAll(config);
        await savePosts(posts);
        console.log(`  Saved ${posts.length} posts to ${DATA_PATH}`);
    }

    console.log(`  Total posts: ${posts.length}`);

    // STEP 2: DOWNLOAD THUMBNAILS
    banner('Step 2/4: Downloading thumbnails');

    if (config.dryRun) {
        console.log('  Skipping downloads in dry-run mode');
    } else {
        posts = await downloadThumbnails(posts, config.thumbnailDir);
        await savePosts(posts);
    }

    // STEP 3: VISION ANALYSIS
    banner('Step 3/4: Vision analysis');

    if (config.dryRun) {
        console.log('  Using mock vision analysis');
        posts = mockVisionAnalysis(posts);
    } else if (!config.anthropicKey) {
        console.log('  No ANTHROPIC_KEY — skipping vision analysis');
    } else {
        posts = await analyzeWithVision(posts, config.anthropicKey);
        await savePosts(posts);
    }

    // STEP 4: GENERATE REPORT
    banner('Step 4/4: Generating weekly brief');

    let brief: string;
    if (config.dryRun || !config.anthropicKey) {
        brief = await generateDryRunReport(posts, config.outputDir);
    } else {
        brief = await generateReport(posts, config.anthropicKey, config.outputDir);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    banner(`DONE in ${elapsed}s`);

    console.log('─'.repeat(60));
    console.log(brief);
    console.log('─'.repeat(60));
    console.log(`\n📁 Full brief saved to: ${join(config.outputDir, 'weekly_brief.md')}`);
    console.log(`📁 Post data saved to: ${DATA_PATH}`);
}

// Entry point
const isDryRun = process.argv.includes('--dry-run') || (!process.env.APIFY_KEY && !process.env.ANTHROPIC_KEY);

if (isDryRun && !process.argv.includes('--dry-run')) {
    console.log('⚠️  No API keys found — running in dry-run mode automatically.');
    console.log('   Set APIFY_KEY and ANTHROPIC_KEY for live data.\n');
}

const config: PipelineConfig = {
    apifyKey: process.env.APIFY_KEY ?? '',
    anthropicKey: process.env.ANTHROPIC_KEY ?? '',
    outputDir: OUTPUT_DIR,
    thumbnailDir: THUMBNAIL_DIR,
    postsPerAccount: 20,
    dryRun: isDryRun,
};

run(config).catch((err) => {
    console.error('\n❌ Pipeline failed:', err.message);
    process.exit(1);
});
