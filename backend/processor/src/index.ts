import 'dotenv/config'
import express from 'express'
import { processZoomWebhook } from './processor'

const app = express()
const port = process.env.PORT || 8080

// Middleware
app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'zoom-phone-processor' })
})

// Pub/Sub Push endpoint
app.post('/webhook', async (req, res) => {
  try {
    // Pub/Sub sends messages in this format:
    // { message: { data: "base64-encoded-string", messageId: "..." } }
    const pubsubMessage = req.body.message

    if (!pubsubMessage || !pubsubMessage.data) {
      console.error('Invalid Pub/Sub message format')
      return res.status(400).json({ error: 'Invalid message format' })
    }

    // Decode base64 message data
    const data = JSON.parse(Buffer.from(pubsubMessage.data, 'base64').toString())
    console.log(`Received message ID: ${pubsubMessage.messageId}`)
    console.log('Processing webhook data:', JSON.stringify(data, null, 2))

    // Process the webhook (don't await to respond quickly to Pub/Sub)
    processZoomWebhook(data)
      .then(() => {
        console.log(`Message ${pubsubMessage.messageId} processed successfully`)
      })
      .catch(error => {
        console.error(`Error processing message ${pubsubMessage.messageId}:`, error)
      })

    // Acknowledge receipt immediately (200 OK tells Pub/Sub we received it)
    res.status(200).json({ status: 'received' })
  } catch (error) {
    console.error('Error handling Pub/Sub message:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Start server
app.listen(port, () => {
  console.log(`Backend Processor running on port ${port}`)
  console.log(`Ready to receive Pub/Sub push messages at /webhook`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  process.exit(0)
})
