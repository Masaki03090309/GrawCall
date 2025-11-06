/**
 * Get Zoom OAuth access token using Server-to-Server OAuth
 * https://developers.zoom.us/docs/internal-apps/s2s-oauth/
 */
export declare function getZoomAccessToken(): Promise<string>;
/**
 * Get download access token for a specific recording
 * https://developers.zoom.us/docs/api/rest/reference/phone/methods/#operation/getPhoneRecordingDownloadAccessToken
 */
export declare function getRecordingDownloadToken(recordingId: string): Promise<string>;
/**
 * Clear cached token (useful for testing or forced refresh)
 */
export declare function clearZoomTokenCache(): void;
//# sourceMappingURL=zoomAuth.d.ts.map