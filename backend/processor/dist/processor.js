'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.processZoomWebhook = processZoomWebhook
const supabase_js_1 = require('@supabase/supabase-js')
const audioDownloader_1 = require('./services/audioDownloader')
const transcription_1 = require('./services/transcription')
const statusDetection_1 = require('./services/statusDetection')
const slackNotification_1 = require('./services/slackNotification')
const zoomAuth_1 = require('./services/zoomAuth')
const feedbackGeneration_1 = require('./services/feedbackGeneration')
// Initialize Supabase client
const supabase = (0, supabase_js_1.createClient)(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
async function processZoomWebhook(data) {
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
async function processRecording(recording) {
  const callId = recording.call_log_id
  console.log(`Processing call ID: ${callId}`)
  try {
    // Step 1: Download audio file
    if (!recording.download_url) {
      console.error('No download URL found in recording')
      return
    }
    console.log('Step 1: Downloading audio file...')
    // Get Zoom OAuth access token for authenticated download
    const zoomAccessToken = await (0, zoomAuth_1.getZoomAccessToken)()
    const fileExtension = 'm4a'
    // Use OAuth Bearer token for download
    const audioResult = await (0, audioDownloader_1.downloadAndUploadAudio)(
      recording.download_url,
      callId,
      fileExtension,
      zoomAccessToken
    )
    console.log(`Audio uploaded: ${audioResult.gcsPath}`)
    // Step 2: Transcribe with Whisper
    console.log('Step 2: Transcribing audio with Whisper API...')
    const transcriptionResult = await (0, transcription_1.transcribeWithRetry)(audioResult.gcsPath)
    console.log(`Transcription complete: ${transcriptionResult.text.length} characters`)
    // Step 3: Detect call status with GPT-5-mini
    console.log('Step 3: Detecting call status...')
    const statusResult = await (0, statusDetection_1.detectCallStatus)(
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
        // project_id and user_id will be determined from phone number matching
        // For now, use null (will be updated in M1.6)
        project_id: null,
        user_id: null,
      })
      .select()
      .single()
    if (error) {
      console.error('Error saving to Supabase:', error)
      throw error
    }
    console.log('Call saved to Supabase:', callRecord.id)
    // Step 4.5: Generate AI Feedback (M2.4)
    console.log('Step 4.5: Generating AI feedback...')
    const feedbackResult = await (0, feedbackGeneration_1.generateFeedback)(
      transcriptionResult.text,
      statusResult.status,
      recording.duration,
      callRecord.project_id
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
    // Step 5: Send Slack notification
    console.log('Step 5: Sending Slack notification...')
    // For now, we don't have project-specific webhook URLs
    // This will be implemented in M1.6 when project management is added
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL
    if (slackWebhookUrl) {
      await (0, slackNotification_1.sendSlackNotification)(slackWebhookUrl, {
        callId: callRecord.id,
        callerNumber: recording.caller_number,
        calledNumber: recording.callee_number,
        callTime: new Date(recording.date_time),
        duration: recording.duration,
        status: statusResult.status,
        feedbackText: callRecord.feedback_text || undefined,
        webAppUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7000',
      })
    }
    console.log(`✅ Call ${callId} processed successfully`)
  } catch (error) {
    console.error(`❌ Error processing call ${callId}:`, error.message)
    throw error
  }
}
//# sourceMappingURL=processor.js.map
