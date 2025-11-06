-- Add transcript_segments column to calls table for SRT format display
-- This stores Whisper API's verbose_json segments with timestamps

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS transcript_segments JSONB;

COMMENT ON COLUMN calls.transcript_segments IS 'Whisper API segments with timestamps for SRT format display. Each segment contains: {id, start, end, text}';
