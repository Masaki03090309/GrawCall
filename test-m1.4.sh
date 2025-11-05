#!/bin/bash
# M1.4 Integration Tests

echo "=== M1.4 テスト実行 ==="
echo ""

# Test 1: Health Check
echo "Test 1: Health Check"
echo "---------------------"
echo "Zoom Proxy:"
curl -k https://zoom-proxy-421962770379.asia-northeast1.run.app/health
echo ""
echo ""
echo "Backend Processor:"
curl -k https://backend-processor-421962770379.asia-northeast1.run.app/health
echo ""
echo ""

# Test 2: GCS Bucket Verification
echo "Test 2: GCS Bucket Verification"
echo "--------------------------------"
gcloud storage buckets describe gs://zoom-phone-feedback-audio
echo ""

# Test 3: Pub/Sub Topics and Subscriptions
echo "Test 3: Pub/Sub Topics and Subscriptions"
echo "-----------------------------------------"
echo "Topic:"
gcloud pubsub topics describe zoom-webhook-topic
echo ""
echo "Subscription:"
gcloud pubsub subscriptions describe zoom-webhook-subscription
echo ""

# Test 4: Secret Manager
echo "Test 4: Secret Manager Secrets"
echo "-------------------------------"
gcloud secrets list --filter="name:openai-api-key OR name:supabase-service-role-key OR name:zoom-webhook-secret"
echo ""

# Test 5: Cloud Run Services
echo "Test 5: Cloud Run Services"
echo "--------------------------"
gcloud run services list --region asia-northeast1
echo ""

echo "=== テスト完了 ==="
