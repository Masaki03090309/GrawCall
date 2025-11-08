import { createClient } from '@supabase/supabase-js'
import { downloadAndUploadAudio } from './services/audioDownloader'
import { transcribeWithRetry } from './services/transcription'
import { detectCallStatus } from './services/statusDetection'
import { sendSlackNotification } from './services/slackNotification'
import { getZoomAccessToken } from './services/zoomAuth'
import { generateFeedback } from './services/feedbackGeneration'
import { analyzeTalkScriptMatch } from './services/talkScriptAnalysis'

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export interface ZoomPhoneRecording {
  id: string
  user_id: string
  caller_number: string
  caller_number_type: number
  caller_name: string
  callee_number: string
  callee_number_type: number
  callee_name: string
  direction: string
  duration: number
  download_url: string
  date_time: string
  recording_type: string
  call_log_id: string
  call_history_id: string
  call_id: string
  end_time: string
  disclaimer_status: number
}

export interface ZoomWebhookData {
  event: string
  payload: {
    account_id: string
    object: {
      recordings: ZoomPhoneRecording[]
    }
  }
}

export async function processZoomWebhook(data: ZoomWebhookData) {
  console.log('Processing Zoom webhook...')

  const { event, payload } = data

  // Accept both recording.completed and phone.recording_completed
  if (event !== 'recording.completed' && event !== 'phone.recording_completed') {
    console.log(`Ignoring event: ${event}`)
    return
  }

  const recordings = payload.object.recordings

  if (!recordings || recordings.length === 0) {
    console.error('No recordings found in webhook payload')
    return
  }

  // Process each recording
  for (const recording of recordings) {
    await processRecording(recording)
  }
}

/**
 * Lookup user by Zoom User ID
 */
async function lookupUserByZoomId(zoomUserId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('zoom_user_id', zoomUserId)
      .maybeSingle()

    if (error) {
      console.error('Error looking up user by Zoom User ID:', error)
      return null
    }

    if (data) {
      console.log(`User found for Zoom User ID ${zoomUserId}: ${data.id}`)
      return data.id
    } else {
      console.log(`No user found for Zoom User ID: ${zoomUserId}`)
      return null
    }
  } catch (error) {
    console.error('Exception in lookupUserByZoomId:', error)
    return null
  }
}

/**
 * Get user's project
 */
async function getUserProject(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error looking up user project:', error)
      return null
    }

    if (data) {
      console.log(`User project found: ${data.project_id}`)
      return data.project_id
    } else {
      console.log('User is not a member of any project')
      return null
    }
  } catch (error) {
    console.error('Exception in getUserProject:', error)
    return null
  }
}

async function processRecording(recording: ZoomPhoneRecording) {
  const callId = recording.call_log_id

  console.log(`Processing call ID: ${callId}`)
  console.log(`Zoom User ID from webhook: ${recording.user_id}`)

  try {
    // Step 0: Lookup user by Zoom User ID
    console.log('Step 0: Looking up user by Zoom User ID...')
    const userId = await lookupUserByZoomId(recording.user_id)

    let projectId: string | null = null

    if (userId) {
      console.log(`Matched user: ${userId}`)

      // Step 0.5: Get user's project
      console.log('Step 0.5: Looking up user project...')
      projectId = await getUserProject(userId)

      if (projectId) {
        console.log(`User belongs to project: ${projectId}`)
      } else {
        console.log('User is not assigned to any project')
      }
    } else {
      console.log('No user matched - call will be saved with user_id=null and project_id=null')
    }

    // Step 1: Download audio file
    if (!recording.download_url) {
      console.error('No download URL found in recording')
      return
    }

    console.log('Step 1: Downloading audio file...')

    // Get Zoom OAuth access token for authenticated download
    const zoomAccessToken = await getZoomAccessToken()
    const fileExtension = 'm4a'

    // Use OAuth Bearer token for download
    const audioResult = await downloadAndUploadAudio(
      recording.download_url,
      callId,
      fileExtension,
      zoomAccessToken
    )

    console.log(`Audio uploaded: ${audioResult.gcsPath}`)

    // Step 2: Transcribe with Whisper
    console.log('Step 2: Transcribing audio with Whisper API...')
    const transcriptionResult = await transcribeWithRetry(audioResult.gcsPath)

    console.log(`Transcription complete: ${transcriptionResult.text.length} characters`)

    // Step 3: Detect call status with GPT-5-mini
    console.log('Step 3: Detecting call status...')
    const statusResult = await detectCallStatus(
      transcriptionResult.text,
      recording.duration || transcriptionResult.duration || 0
    )

    console.log(`Status detected: ${statusResult.status} (confidence: ${statusResult.confidence})`)

    // Step 4: Save to Supabase
    console.log('Step 4: Saving call data to Supabase...')

    const transcriptPath = audioResult.gcsPath.replace(/audio\/(.+)\.\w+$/, 'transcripts/$1.txt')

    const { data: callRecord, error } = await supabase
      .from('calls')
      .insert({
        zoom_call_id: callId,
        zoom_recording_id: recording.id,
        call_time: new Date(recording.date_time),
        duration_seconds: recording.duration,
        direction: recording.direction,
        caller_number: recording.caller_number || null,
        callee_number: recording.callee_number || null,
        status: statusResult.status,
        status_confidence: statusResult.confidence,
        audio_url: audioResult.gcsPath,
        transcript_url: transcriptPath,
        transcript_segments: transcriptionResult.segments || null,
        // Zoom User ID from webhook payload (primary identifier)
        zoom_user_id: recording.user_id,
        // Auto-assigned user_id from Zoom User ID lookup (for reference)
        user_id: userId || null,
        // Auto-assigned project_id from user's project membership
        project_id: projectId || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving to Supabase:', error)
      throw error
    }

    console.log('Call saved to Supabase:', callRecord.id)

    // Step 4.3: Analyze talk script match (M3.3) - Phase 3
    console.log('Step 4.3: Analyzing talk script match...')
    const analysisResult = await analyzeTalkScriptMatch(
      transcriptionResult.text,
      callRecord.project_id
    )

    if (analysisResult.should_analyze) {
      console.log(
        `Talk script analysis complete: overall=${analysisResult.overall_match_rate}%`
      )

      // Update call record with analysis results
      const { error: analysisUpdateError } = await supabase
        .from('calls')
        .update({
          phase_match_rates: analysisResult.phase_match_rates,
          hearing_item_coverage: analysisResult.hearing_item_coverage,
        })
        .eq('id', callRecord.id)

      if (analysisUpdateError) {
        console.error('Error updating call with analysis results:', analysisUpdateError)
      } else {
        console.log('Talk script analysis results saved to Supabase')
        // Update callRecord with analysis for feedback generation
        callRecord.phase_match_rates = analysisResult.phase_match_rates as any
        callRecord.hearing_item_coverage = analysisResult.hearing_item_coverage as any
      }
    } else {
      console.log('Talk script analysis skipped (no project or no talk script)')
    }

    // Step 4.5: Generate AI Feedback (M2.4)
    console.log('Step 4.5: Generating AI feedback...')
    const feedbackResult = await generateFeedback(
      transcriptionResult.text,
      statusResult.status,
      recording.duration,
      callRecord.project_id,
      analysisResult.should_analyze ? analysisResult : undefined
    )

    if (feedbackResult.should_generate && feedbackResult.feedback_text) {
      console.log(
        `Feedback generated successfully (${feedbackResult.feedback_text.length} characters)`
      )

      // Update call record with feedback
      const { error: updateError } = await supabase
        .from('calls')
        .update({
          feedback_text: feedbackResult.feedback_text,
          prompt_version_id: feedbackResult.prompt_version_id,
        })
        .eq('id', callRecord.id)

      if (updateError) {
        console.error('Error updating call with feedback:', updateError)
      } else {
        console.log('Feedback saved to Supabase')
        // Update callRecord with feedback for Slack notification
        callRecord.feedback_text = feedbackResult.feedback_text
      }
    } else {
      console.log(`Feedback not generated: ${feedbackResult.skip_reason || 'Unknown reason'}`)
    }

    // Step 5: Send Slack notification (only for connected calls)
    console.log('Step 5: Checking if Slack notification should be sent...')

    if (statusResult.status === 'connected' && callRecord.project_id) {
      console.log('Call is connected and has project_id, fetching project details...')

      // Fetch project details including webhook URL
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('name, slack_webhook_url')
        .eq('id', callRecord.project_id)
        .single()

      if (projectError) {
        console.error('Error fetching project for Slack notification:', projectError)
      } else if (projectData?.slack_webhook_url) {
        console.log(`Project webhook found: ${projectData.name}`)

        // Fetch user details if available
        let userName: string | undefined
        if (callRecord.user_id) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('name')
            .eq('id', callRecord.user_id)
            .single()

          if (!userError && userData) {
            userName = userData.name
          }
        }

        // Send notification with project-specific webhook
        await sendSlackNotification(projectData.slack_webhook_url, {
          callId: callRecord.id,
          callerNumber: recording.caller_number,
          calledNumber: recording.callee_number,
          callTime: new Date(recording.date_time),
          duration: recording.duration,
          status: statusResult.status,
          feedbackText: callRecord.feedback_text || undefined,
          webAppUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7000',
          projectName: projectData.name,
          userName: userName,
        })
      } else {
        console.log('Project webhook URL not configured, skipping notification')
      }
    } else {
      console.log(
        `Skipping Slack notification (status: ${statusResult.status}, has project: ${!!callRecord.project_id})`
      )
    }

    console.log(`✅ Call ${callId} processed successfully`)
  } catch (error: any) {
    console.error(`❌ Error processing call ${callId}:`, error.message)
    throw error
  }
}
