"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processZoomWebhook = processZoomWebhook;
const supabase_js_1 = require("@supabase/supabase-js");
const audioDownloader_1 = require("./services/audioDownloader");
const transcription_1 = require("./services/transcription");
const statusDetection_1 = require("./services/statusDetection");
const slackNotification_1 = require("./services/slackNotification");
const zoomAuth_1 = require("./services/zoomAuth");
const feedbackGeneration_1 = require("./services/feedbackGeneration");
const talkScriptAnalysis_1 = require("./services/talkScriptAnalysis");
// Initialize Supabase client
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function processZoomWebhook(data) {
    console.log('Processing Zoom webhook...');
    const { event, payload } = data;
    // Accept both recording.completed and phone.recording_completed
    if (event !== 'recording.completed' && event !== 'phone.recording_completed') {
        console.log(`Ignoring event: ${event}`);
        return;
    }
    const recordings = payload.object.recordings;
    if (!recordings || recordings.length === 0) {
        console.error('No recordings found in webhook payload');
        return;
    }
    // Process each recording
    for (const recording of recordings) {
        await processRecording(recording);
    }
}
/**
 * Lookup user by Zoom User ID
 */
async function lookupUserByZoomId(zoomUserId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('zoom_user_id', zoomUserId)
            .maybeSingle();
        if (error) {
            console.error('Error looking up user by Zoom User ID:', error);
            return null;
        }
        if (data) {
            console.log(`User found for Zoom User ID ${zoomUserId}: ${data.id}`);
            return data.id;
        }
        else {
            console.log(`No user found for Zoom User ID: ${zoomUserId}`);
            return null;
        }
    }
    catch (error) {
        console.error('Exception in lookupUserByZoomId:', error);
        return null;
    }
}
async function processRecording(recording) {
    const callId = recording.call_log_id;
    console.log(`Processing call ID: ${callId}`);
    console.log(`Zoom User ID from webhook: ${recording.user_id}`);
    try {
        // Step 0: Lookup user by Zoom User ID
        console.log('Step 0: Looking up user by Zoom User ID...');
        const userId = await lookupUserByZoomId(recording.user_id);
        if (userId) {
            console.log(`Matched user: ${userId}`);
        }
        else {
            console.log('No user matched - call will be saved with user_id=null');
        }
        // Step 1: Download audio file
        if (!recording.download_url) {
            console.error('No download URL found in recording');
            return;
        }
        console.log('Step 1: Downloading audio file...');
        // Get Zoom OAuth access token for authenticated download
        const zoomAccessToken = await (0, zoomAuth_1.getZoomAccessToken)();
        const fileExtension = 'm4a';
        // Use OAuth Bearer token for download
        const audioResult = await (0, audioDownloader_1.downloadAndUploadAudio)(recording.download_url, callId, fileExtension, zoomAccessToken);
        console.log(`Audio uploaded: ${audioResult.gcsPath}`);
        // Step 2: Transcribe with Whisper
        console.log('Step 2: Transcribing audio with Whisper API...');
        const transcriptionResult = await (0, transcription_1.transcribeWithRetry)(audioResult.gcsPath);
        console.log(`Transcription complete: ${transcriptionResult.text.length} characters`);
        // Step 3: Detect call status with GPT-5-mini
        console.log('Step 3: Detecting call status...');
        const statusResult = await (0, statusDetection_1.detectCallStatus)(transcriptionResult.text, recording.duration || transcriptionResult.duration || 0);
        console.log(`Status detected: ${statusResult.status} (confidence: ${statusResult.confidence})`);
        // Step 4: Save to Supabase
        console.log('Step 4: Saving call data to Supabase...');
        const transcriptPath = audioResult.gcsPath.replace(/audio\/(.+)\.\w+$/, 'transcripts/$1.txt');
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
            // Auto-assigned user_id from Zoom User ID lookup
            user_id: userId || null,
            // project_id will be determined from phone number matching (M1.6)
            project_id: null,
        })
            .select()
            .single();
        if (error) {
            console.error('Error saving to Supabase:', error);
            throw error;
        }
        console.log('Call saved to Supabase:', callRecord.id);
        // Step 4.3: Analyze talk script match (M3.3) - Phase 3
        console.log('Step 4.3: Analyzing talk script match...');
        const analysisResult = await (0, talkScriptAnalysis_1.analyzeTalkScriptMatch)(transcriptionResult.text, callRecord.project_id);
        if (analysisResult.should_analyze) {
            console.log(`Talk script analysis complete: overall=${analysisResult.overall_match_rate}%`);
            // Update call record with analysis results
            const { error: analysisUpdateError } = await supabase
                .from('calls')
                .update({
                phase_match_rates: analysisResult.phase_match_rates,
                hearing_item_coverage: analysisResult.hearing_item_coverage,
            })
                .eq('id', callRecord.id);
            if (analysisUpdateError) {
                console.error('Error updating call with analysis results:', analysisUpdateError);
            }
            else {
                console.log('Talk script analysis results saved to Supabase');
                // Update callRecord with analysis for feedback generation
                callRecord.phase_match_rates = analysisResult.phase_match_rates;
                callRecord.hearing_item_coverage = analysisResult.hearing_item_coverage;
            }
        }
        else {
            console.log('Talk script analysis skipped (no project or no talk script)');
        }
        // Step 4.5: Generate AI Feedback (M2.4)
        console.log('Step 4.5: Generating AI feedback...');
        const feedbackResult = await (0, feedbackGeneration_1.generateFeedback)(transcriptionResult.text, statusResult.status, recording.duration, callRecord.project_id, analysisResult.should_analyze ? analysisResult : undefined);
        if (feedbackResult.should_generate && feedbackResult.feedback_text) {
            console.log(`Feedback generated successfully (${feedbackResult.feedback_text.length} characters)`);
            // Update call record with feedback
            const { error: updateError } = await supabase
                .from('calls')
                .update({
                feedback_text: feedbackResult.feedback_text,
                prompt_version_id: feedbackResult.prompt_version_id,
            })
                .eq('id', callRecord.id);
            if (updateError) {
                console.error('Error updating call with feedback:', updateError);
            }
            else {
                console.log('Feedback saved to Supabase');
                // Update callRecord with feedback for Slack notification
                callRecord.feedback_text = feedbackResult.feedback_text;
            }
        }
        else {
            console.log(`Feedback not generated: ${feedbackResult.skip_reason || 'Unknown reason'}`);
        }
        // Step 5: Send Slack notification
        console.log('Step 5: Sending Slack notification...');
        // For now, we don't have project-specific webhook URLs
        // This will be implemented in M1.6 when project management is added
        const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
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
            });
        }
        console.log(`✅ Call ${callId} processed successfully`);
    }
    catch (error) {
        console.error(`❌ Error processing call ${callId}:`, error.message);
        throw error;
    }
}
//# sourceMappingURL=processor.js.map