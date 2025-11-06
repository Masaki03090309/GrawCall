import OpenAI from 'openai'
import { Storage } from '@google-cloud/storage'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
})

const bucketName = process.env.GCS_BUCKET_NAME || 'zoom-phone-feedback-audio'

export interface TranscriptionSegment {
  id: number
  start: number
  end: number
  text: string
}

export interface TranscriptionResult {
  text: string
  duration?: number
  language?: string
  segments?: TranscriptionSegment[]
}

/**
 * Transcribe audio file using OpenAI Whisper API
 */
export async function transcribeAudio(audioGcsPath: string): Promise<TranscriptionResult> {
  console.log(`Transcribing audio from: ${audioGcsPath}`)

  try {
    // Download audio from GCS to temporary file
    const tempDir = os.tmpdir()
    const fileName = path.basename(audioGcsPath)
    const localFilePath = path.join(tempDir, fileName)

    const bucket = storage.bucket(bucketName)
    const file = bucket.file(audioGcsPath)

    await file.download({ destination: localFilePath })
    console.log(`Downloaded to temp file: ${localFilePath}`)

    // Check file size (Whisper API has 25MB limit)
    const stats = fs.statSync(localFilePath)
    const fileSizeMB = stats.size / 1024 / 1024

    if (fileSizeMB > 25) {
      throw new Error(`Audio file too large: ${fileSizeMB.toFixed(2)}MB (max 25MB)`)
    }

    // Create read stream for Whisper API
    const audioStream = fs.createReadStream(localFilePath)

    // Call Whisper API
    console.log('Calling Whisper API...')
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      language: 'ja', // Japanese
      response_format: 'verbose_json',
    })

    // Clean up temporary file
    fs.unlinkSync(localFilePath)
    console.log('Cleaned up temp file')

    // Save transcription to GCS
    const transcriptPath = audioGcsPath.replace(/audio\/(.+)\.\w+$/, 'transcripts/$1.txt')
    const transcriptFile = bucket.file(transcriptPath)

    await transcriptFile.save(transcription.text, {
      contentType: 'text/plain; charset=utf-8',
      metadata: {
        cacheControl: 'public, max-age=31536000',
        metadata: {
          language: transcription.language || 'ja',
          duration: transcription.duration?.toString() || 'unknown',
          transcribedAt: new Date().toISOString(),
        },
      },
    })

    console.log(`Saved transcription to: gs://${bucketName}/${transcriptPath}`)

    // Extract segments with timestamps for SRT format
    const segments: TranscriptionSegment[] = (transcription.segments || []).map((seg: any) => ({
      id: seg.id,
      start: seg.start,
      end: seg.end,
      text: seg.text,
    }))

    return {
      text: transcription.text,
      duration: transcription.duration,
      language: transcription.language,
      segments,
    }
  } catch (error: any) {
    console.error('Error transcribing audio:', error.message)
    console.error('Full error details:', JSON.stringify(error, null, 2))
    console.error('Error stack:', error.stack)
    throw new Error(`Failed to transcribe audio: ${error.message}`)
  }
}

/**
 * Retry wrapper for OpenAI API calls with exponential backoff
 */
export async function transcribeWithRetry(
  audioGcsPath: string,
  maxRetries: number = 3
): Promise<TranscriptionResult> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await transcribeAudio(audioGcsPath)
    } catch (error: any) {
      lastError = error
      console.error(`Transcription attempt ${attempt} failed:`, error.message)

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
        console.log(`Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('Transcription failed after retries')
}
