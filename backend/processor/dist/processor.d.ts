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
export declare function processZoomWebhook(data: ZoomWebhookData): Promise<void>
//# sourceMappingURL=processor.d.ts.map
