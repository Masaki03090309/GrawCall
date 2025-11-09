'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.downloadAndUploadAudio = downloadAndUploadAudio
exports.generateSignedUrl = generateSignedUrl
const axios_1 = __importDefault(require('axios'))
const storage_1 = require('@google-cloud/storage')
const storage = new storage_1.Storage({
  projectId: process.env.GCP_PROJECT_ID,
})
const bucketName = process.env.GCS_BUCKET_NAME || 'zoom-phone-feedback-audio'
/**
 * Download audio file from Zoom and upload to GCS
 */
async function downloadAndUploadAudio(downloadUrl, callId, fileExtension = 'mp3', zoomAccessToken) {
  console.log(`Downloading audio for call ${callId}...`)
  try {
    // Download audio from Zoom
    const headers = {
      'User-Agent': 'Zoom-Phone-Feedback-System/1.0',
    }
    // Add Zoom access token if provided
    if (zoomAccessToken) {
      headers['Authorization'] = `Bearer ${zoomAccessToken}`
    }
    const response = await axios_1.default.get(downloadUrl, {
      responseType: 'arraybuffer',
      headers,
      timeout: 60000, // 60 seconds timeout
    })
    const audioBuffer = Buffer.from(response.data)
    const fileSizeBytes = audioBuffer.length
    console.log(`Downloaded audio: ${fileSizeBytes} bytes`)
    // Upload to GCS
    const gcsPath = `audio/${callId}.${fileExtension}`
    const bucket = storage.bucket(bucketName)
    const file = bucket.file(gcsPath)
    await file.save(audioBuffer, {
      contentType: `audio/${fileExtension}`,
      metadata: {
        cacheControl: 'public, max-age=31536000',
        metadata: {
          callId: callId,
          uploadedAt: new Date().toISOString(),
        },
      },
    })
    console.log(`Uploaded to GCS: gs://${bucketName}/${gcsPath}`)
    // Estimate duration (rough approximation: 1MB ≈ 1 minute for compressed audio)
    const estimatedDuration = Math.round((fileSizeBytes / 1024 / 1024) * 60)
    return {
      gcsPath,
      fileSizeBytes,
      duration: estimatedDuration,
    }
  } catch (error) {
    console.error('Error downloading/uploading audio:', error.message)
    throw new Error(`Failed to download audio: ${error.message}`)
  }
}
/**
 * Generate signed URL for audio file access (1 hour expiration)
 */
async function generateSignedUrl(gcsPath) {
  const bucket = storage.bucket(bucketName)
  const file = bucket.file(gcsPath)
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  })
  return url
}
//# sourceMappingURL=audioDownloader.js.map
