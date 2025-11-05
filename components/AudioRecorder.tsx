'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Mic, Square } from 'lucide-react'
import { toast } from 'sonner'

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, audioBase64: string) => void
  maxDurationSeconds?: number
}

export default function AudioRecorder({
  onRecordingComplete,
  maxDurationSeconds = 300, // 5 minutes default
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioURL, setAudioURL] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
      }
    }
  }, [isRecording])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(audioBlob)
        setAudioURL(url)

        // Convert to base64
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          onRecordingComplete(audioBlob, base64)
        }
        reader.readAsDataURL(audioBlob)

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          if (newTime >= maxDurationSeconds) {
            stopRecording()
            toast.info(`最大録音時間 ${maxDurationSeconds}秒に達しました`)
          }
          return newTime
        })
      }, 1000)
    } catch (error) {
      console.error('Error starting recording:', error)
      toast.error('マイクへのアクセスに失敗しました')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                size="lg"
                className="w-full sm:w-auto"
                disabled={isRecording}
              >
                <Mic className="mr-2 h-5 w-5" />
                音声を録音
              </Button>
            ) : (
              <>
                <div className="flex items-center gap-2 text-red-600">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-red-600" />
                  <span className="text-lg font-semibold">録音中...</span>
                </div>
                <div className="font-mono text-2xl">{formatTime(recordingTime)}</div>
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  <Square className="mr-2 h-5 w-5" />
                  停止
                </Button>
              </>
            )}
          </div>

          {audioURL && !isRecording && (
            <div className="space-y-2">
              <p className="text-sm font-medium">録音された音声:</p>
              <audio src={audioURL} controls className="w-full" />
              <p className="text-xs text-gray-500">録音時間: {formatTime(recordingTime)}</p>
            </div>
          )}

          <div className="space-y-1 text-xs text-gray-500">
            <p>
              • 最大録音時間: {maxDurationSeconds}秒 ({Math.floor(maxDurationSeconds / 60)}分)
            </p>
            <p>• 録音開始前にマイクへのアクセスを許可してください</p>
            <p>• 録音した音声は自動的に文字起こしされます</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
