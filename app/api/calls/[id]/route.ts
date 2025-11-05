import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Storage } from '@google-cloud/storage'

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: process.env.GCP_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
    : undefined,
})

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'zoom-phone-feedback-audio'

/**
 * GET /api/calls/:id
 * Get call details by ID
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '認証が必要です',
          },
        },
        { status: 401 }
      )
    }

    const callId = params.id

    // Fetch call details with related data
    // RLS automatically filters based on user permissions
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select(
        `
        *,
        user:users(id, name, email),
        project:projects(id, name),
        prompt:prompts(id, version, prompt_type, created_at)
      `
      )
      .eq('id', callId)
      .maybeSingle()

    if (callError) {
      console.error('Error fetching call:', callError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'データベースエラーが発生しました',
            details: callError,
          },
        },
        { status: 500 }
      )
    }

    if (!call) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '通話が見つかりません',
          },
        },
        { status: 404 }
      )
    }

    // Generate signed URLs for audio and transcript files (with error handling)
    let audioSignedUrl: string | null = null
    if (call.audio_url) {
      try {
        audioSignedUrl = await generateSignedUrl(call.audio_url)
      } catch (error: any) {
        console.error('Error generating audio signed URL:', error.message)
        // Continue without signed URL
      }
    }

    let transcriptSignedUrl: string | null = null
    if (call.transcript_url) {
      try {
        transcriptSignedUrl = await generateSignedUrl(call.transcript_url)
      } catch (error: any) {
        console.error('Error generating transcript signed URL:', error.message)
        // Continue without signed URL
      }
    }

    // Get transcript text if available
    let transcriptText: string | null = null
    if (call.transcript_url) {
      try {
        transcriptText = await getTranscriptText(call.transcript_url)
      } catch (error: any) {
        console.error('Error fetching transcript text:', error.message)
        // Continue without transcript text
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...call,
        audio_signed_url: audioSignedUrl,
        transcript_signed_url: transcriptSignedUrl,
        transcript_text: transcriptText,
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/calls/:id:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバーエラーが発生しました',
          details: error.message,
        },
      },
      { status: 500 }
    )
  }
}

/**
 * Generate signed URL for GCS file (1 hour expiration)
 */
async function generateSignedUrl(gcsPath: string): Promise<string> {
  try {
    const bucket = storage.bucket(BUCKET_NAME)
    const file = bucket.file(gcsPath)

    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    })

    return signedUrl
  } catch (error: any) {
    console.error(`Error generating signed URL for ${gcsPath}:`, error.message)
    throw error
  }
}

/**
 * Get transcript text from GCS
 */
async function getTranscriptText(gcsPath: string): Promise<string> {
  try {
    const bucket = storage.bucket(BUCKET_NAME)
    const file = bucket.file(gcsPath)

    const [contents] = await file.download()
    return contents.toString('utf-8')
  } catch (error: any) {
    console.error(`Error downloading transcript from ${gcsPath}:`, error.message)
    throw error
  }
}
