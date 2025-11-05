'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.getZoomAccessToken = getZoomAccessToken
exports.getRecordingDownloadToken = getRecordingDownloadToken
exports.clearZoomTokenCache = clearZoomTokenCache
const axios_1 = __importDefault(require('axios'))
let cachedAccessToken = null
let tokenExpiresAt = 0
/**
 * Get Zoom OAuth access token using Server-to-Server OAuth
 * https://developers.zoom.us/docs/internal-apps/s2s-oauth/
 */
async function getZoomAccessToken() {
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
    const response = await axios_1.default.post(
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
  } catch (error) {
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
async function getRecordingDownloadToken(recordingId) {
  console.log(`Getting download token for recording ${recordingId}...`)
  const accessToken = await getZoomAccessToken()
  try {
    const response = await axios_1.default.get(
      `https://api.zoom.us/v2/phone/recording/${recordingId}/download_access_token`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    console.log('Download access token obtained')
    return response.data.download_access_token
  } catch (error) {
    console.error('Error getting download access token:', error.response?.data || error.message)
    throw new Error(
      `Failed to get download access token: ${error.response?.data?.message || error.message}`
    )
  }
}
/**
 * Clear cached token (useful for testing or forced refresh)
 */
function clearZoomTokenCache() {
  cachedAccessToken = null
  tokenExpiresAt = 0
  console.log('Zoom token cache cleared')
}
//# sourceMappingURL=zoomAuth.js.map
