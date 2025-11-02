import { Storage } from '@google-cloud/storage'

/**
 * Google Cloud Storage Client
 */
export const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE, // Path to service account key file
})

export const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || '')

/**
 * Upload a file to GCS
 */
export async function uploadFile(
  buffer: Buffer,
  filePath: string,
  contentType: string
): Promise<string> {
  const file = bucket.file(filePath)

  await file.save(buffer, {
    metadata: {
      contentType,
      metadata: {
        uploadedAt: new Date().toISOString(),
      },
    },
  })

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`
  return publicUrl
}

/**
 * Get a signed URL for a file (1 hour expiration)
 */
export async function getSignedUrl(filePath: string): Promise<string> {
  const file = bucket.file(filePath)

  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  })

  return signedUrl
}

/**
 * Delete a file from GCS
 */
export async function deleteFile(filePath: string): Promise<void> {
  const file = bucket.file(filePath)
  await file.delete()
}
