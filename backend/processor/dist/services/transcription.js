'use strict'
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        var desc = Object.getOwnPropertyDescriptor(m, k)
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k]
            },
          }
        }
        Object.defineProperty(o, k2, desc)
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        o[k2] = m[k]
      })
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v })
      }
    : function (o, v) {
        o['default'] = v
      })
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = []
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k
          return ar
        }
      return ownKeys(o)
    }
    return function (mod) {
      if (mod && mod.__esModule) return mod
      var result = {}
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i])
      __setModuleDefault(result, mod)
      return result
    }
  })()
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.transcribeAudio = transcribeAudio
exports.transcribeWithRetry = transcribeWithRetry
const openai_1 = __importDefault(require('openai'))
const storage_1 = require('@google-cloud/storage')
const fs = __importStar(require('fs'))
const path = __importStar(require('path'))
const os = __importStar(require('os'))
const openai = new openai_1.default({
  apiKey: process.env.OPENAI_API_KEY,
})
const storage = new storage_1.Storage({
  projectId: process.env.GCP_PROJECT_ID,
})
const bucketName = process.env.GCS_BUCKET_NAME || 'zoom-phone-feedback-audio'
/**
 * Transcribe audio file using OpenAI Whisper API
 */
async function transcribeAudio(audioGcsPath) {
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
    return {
      text: transcription.text,
      duration: transcription.duration,
      language: transcription.language,
    }
  } catch (error) {
    console.error('Error transcribing audio:', error.message)
    console.error('Full error details:', JSON.stringify(error, null, 2))
    console.error('Error stack:', error.stack)
    throw new Error(`Failed to transcribe audio: ${error.message}`)
  }
}
/**
 * Retry wrapper for OpenAI API calls with exponential backoff
 */
async function transcribeWithRetry(audioGcsPath, maxRetries = 3) {
  let lastError = null
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await transcribeAudio(audioGcsPath)
    } catch (error) {
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
//# sourceMappingURL=transcription.js.map
