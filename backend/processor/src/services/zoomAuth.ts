import axios from 'axios'

interface ZoomTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

let cachedAccessToken: string | null = null
let tokenExpiresAt: number = 0

/**
 * Get Zoom OAuth access token using Server-to-Server OAuth
 * https://developers.zoom.us/docs/internal-apps/s2s-oauth/
 */
export async function getZoomAccessToken(): Promise<string> {
  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      'Missing Zoom OAuth credentials. Please set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET environment variables.'
    )
  }

  // Return cached token if still valid
  const now = Date.now()
  if (cachedAccessToken && tokenExpiresAt > now + 60000) {
    console.log('Using cached Zoom access token')
    return cachedAccessToken
  }

  console.log('Requesting new Zoom access token...')

  try {
    const response = await axios.post<ZoomTokenResponse>(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {},
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    cachedAccessToken = response.data.access_token
    tokenExpiresAt = Date.now() + response.data.expires_in * 1000

    console.log(`Zoom access token obtained (expires in ${response.data.expires_in} seconds)`)

    return cachedAccessToken
  } catch (error: any) {
    console.error('Error getting Zoom access token:', error.response?.data || error.message)
    throw new Error(
      `Failed to obtain Zoom access token: ${error.response?.data?.message || error.message}`
    )
  }
}

/**
 * Get download access token for a specific recording
 * https://developers.zoom.us/docs/api/rest/reference/phone/methods/#operation/getPhoneRecordingDownloadAccessToken
 */
export async function getRecordingDownloadToken(recordingId: string): Promise<string> {
  console.log(`Getting download token for recording ${recordingId}...`)

  const accessToken = await getZoomAccessToken()

  try {
    const response = await axios.get(
      `https://api.zoom.us/v2/phone/recording/${recordingId}/download_access_token`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    console.log('Download access token obtained')
    return response.data.download_access_token
  } catch (error: any) {
    console.error('Error getting download access token:', error.response?.data || error.message)
    throw new Error(
      `Failed to get download access token: ${error.response?.data?.message || error.message}`
    )
  }
}

/**
 * Clear cached token (useful for testing or forced refresh)
 */
export function clearZoomTokenCache(): void {
  cachedAccessToken = null
  tokenExpiresAt = 0
  console.log('Zoom token cache cleared')
}
