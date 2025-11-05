import 'dotenv/config'
import express from 'express'
import crypto from 'crypto'
import { PubSub } from '@google-cloud/pubsub'

const app = express()
const port = process.env.PORT || 8080

// Middleware
app.use(express.json())
app.use(express.raw({ type: 'application/json' }))

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'zoom-phone-proxy' })
})

// Initialize Pub/Sub
const pubsub = new PubSub({
  projectId: process.env.GCP_PROJECT_ID,
})

const topicName = process.env.PUBSUB_TOPIC_NAME || 'zoom-webhook-topic'

// Zoom webhook signature verification
function verifyZoomWebhookSignature(
  requestBody: string,
  signature: string,
  timestamp: string
): boolean {
  const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN

  if (!secretToken) {
    console.error('ZOOM_WEBHOOK_SECRET_TOKEN not configured')
    return false
  }

  const message = `v0:${timestamp}:${requestBody}`
  const hashForVerify = crypto.createHmac('sha256', secretToken).update(message).digest('hex')

  const expectedSignature = `v0=${hashForVerify}`

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
}

// Zoom webhook endpoint
app.post('/webhook/zoom', async (req, res) => {
  try {
    console.log('Received Zoom webhook')
    console.log('Headers:', req.headers)
    console.log('Body:', req.body)

    // Handle Zoom's URL validation request
    // Zoom sends a POST request with a plainToken for initial validation
    if (req.body.event === 'endpoint.url_validation') {
      console.log('URL validation request received')
      const plainToken = req.body.payload?.plainToken

      if (!plainToken) {
        console.error('No plainToken found in validation request')
        return res.status(400).json({ error: 'No plainToken provided' })
      }

      const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN
      if (!secretToken) {
        console.error('ZOOM_WEBHOOK_SECRET_TOKEN not configured')
        return res.status(500).json({ error: 'Server configuration error' })
      }

      // Generate encrypted token
      const encryptedToken = crypto
        .createHmac('sha256', secretToken)
        .update(plainToken)
        .digest('hex')

      console.log('Sending encrypted token for validation')
      return res.status(200).json({
        plainToken: plainToken,
        encryptedToken: encryptedToken,
      })
    }

    // For actual webhook events, verify signature
    const signature = req.headers['x-zm-signature'] as string
    const timestamp = req.headers['x-zm-request-timestamp'] as string

    if (signature && timestamp) {
      const requestBody = JSON.stringify(req.body)

      // Verify signature
      if (!verifyZoomWebhookSignature(requestBody, signature, timestamp)) {
        console.error('Invalid webhook signature')
        return res.status(401).json({ error: 'Unauthorized' })
      }

      console.log('Webhook signature verified')
    } else {
      console.warn('No signature/timestamp found, skipping verification')
    }

    // Publish to Pub/Sub
    const topic = pubsub.topic(topicName)
    const messageBuffer = Buffer.from(JSON.stringify(req.body))

    await topic.publishMessage({ data: messageBuffer })

    console.log(`Published message to topic: ${topicName}`)

    res.status(200).json({ status: 'success' })
  } catch (error) {
    console.error('Error processing webhook:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Start server
app.listen(port, () => {
  console.log(`Zoom Proxy running on port ${port}`)
  console.log(`Project ID: ${process.env.GCP_PROJECT_ID}`)
  console.log(`Topic: ${topicName}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  process.exit(0)
})
