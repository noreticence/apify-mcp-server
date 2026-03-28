export interface Post {
    id: string;
    platform: 'instagram' | 'tiktok';
    account: string;
    url: string;
    caption: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    audio: string | null;
    audioArtist: string | null;
    duration: number | null;
    timestamp: string;
    thumbnailUrl: string | null;
    thumbnailPath: string | null;
    visionAnalysis: string | null;
}

export interface PipelineConfig {
    apifyKey: string;
    anthropicKey: string;
    outputDir: string;
    thumbnailDir: string;
    postsPerAccount: number;
    dryRun?: boolean;
}
