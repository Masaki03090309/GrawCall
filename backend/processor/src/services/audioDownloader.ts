import axios from 'axios'
import { Storage } from '@google-cloud/storage'

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
})

const bucketName = process.env.GCS_BUCKET_NAME || 'zoom-phone-feedback-audio'

export interface DownloadResult {
  gcsPath: string
  fileSizeBytes: number
  duration: number
}

/**
 * Download audio file from Zoom and upload to GCS
 */
export async function downloadAndUploadAudio(
  downloadUrl: string,
  callId: string,
  fileExtension: string = 'mp3',
  zoomAccessToken?: string
): Promise<DownloadResult> {
  console.log(`Downloading audio for call ${callId}...`)

  try {
    // Download audio from Zoom
    const headers: any = {
      'User-Agent': 'Zoom-Phone-Feedback-System/1.0',
    }

    // Add Zoom access token if provided
    if (zoomAccessToken) {
      headers['Authorization'] = `Bearer ${zoomAccessToken}`
    }

    const response = await axios.get(downloadUrl, {
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
  } catch (error: any) {
    console.error('Error downloading/uploading audio:', error.message)
    throw new Error(`Failed to download audio: ${error.message}`)
  }
}

/**
 * Generate signed URL for audio file access (1 hour expiration)
 */
export async function generateSignedUrl(gcsPath: string): Promise<string> {
  const bucket = storage.bucket(bucketName)
  const file = bucket.file(gcsPath)

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  })

  return url
}
