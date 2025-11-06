export interface DownloadResult {
    gcsPath: string;
    fileSizeBytes: number;
    duration: number;
}
/**
 * Download audio file from Zoom and upload to GCS
 */
export declare function downloadAndUploadAudio(downloadUrl: string, callId: string, fileExtension?: string, zoomAccessToken?: string): Promise<DownloadResult>;
/**
 * Generate signed URL for audio file access (1 hour expiration)
 */
export declare function generateSignedUrl(gcsPath: string): Promise<string>;
//# sourceMappingURL=audioDownloader.d.ts.map