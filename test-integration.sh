#!/bin/bash
# M1.4 統合テスト - Pub/Sub メッセージフロー

echo "=== Pub/Sub 統合テスト ==="
echo ""

# Test 1: Pub/Sub にテストメッセージを発行
echo "Test 1: Pub/Sub メッセージ発行"
echo "-------------------------------"

TEST_MESSAGE='{
  "event": "test.event",
  "payload": {
    "object": {
      "id": "test-call-12345",
      "topic": "Integration Test Call",
      "start_time": "2025-01-15T10:00:00Z",
      "duration": 120
    }
  }
}'

echo "メッセージ内容:"
echo "$TEST_MESSAGE" | jq .
echo ""

echo "Pub/Sub トピックに発行中..."
gcloud pubsub topics publish zoom-webhook-topic --message="$TEST_MESSAGE"
echo ""

# Test 2: Backend Processor のログ確認
echo "Test 2: Backend Processor ログ確認"
echo "-----------------------------------"
echo "最新のログを取得中（10秒待機）..."
sleep 10

gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=backend-processor AND severity>=INFO" \
  --limit 20 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=1m

echo ""

# Test 3: Zoom Proxy へのテストリクエスト（署名なし - エラー確認）
echo "Test 3: Zoom Proxy エンドポイントテスト"
echo "----------------------------------------"
echo "無効な署名でリクエスト送信（401エラーが期待される）:"

curl -k -X POST https://zoom-proxy-421962770379.asia-northeast1.run.app/webhook/zoom \
  -H "Content-Type: application/json" \
  -H "x-zm-signature: invalid-signature" \
  -H "x-zm-request-timestamp: $(date +%s)" \
  -d "$TEST_MESSAGE" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""

# Test 4: Cloud Run サービスのメトリクス確認
echo "Test 4: Cloud Run メトリクス"
echo "----------------------------"
echo "Zoom Proxy:"
gcloud run services describe zoom-proxy --region asia-northeast1 --format="value(status.url,status.conditions)"
echo ""
echo "Backend Processor:"
gcloud run services describe backend-processor --region asia-northeast1 --format="value(status.url,status.conditions)"

echo ""
echo "=== 統合テスト完了 ==="
echo ""
echo "次のステップ:"
echo "1. GCP Console でログを確認: https://console.cloud.google.com/logs"
echo "2. Cloud Run のメトリクスを確認: https://console.cloud.google.com/run"
echo "3. Pub/Sub のメトリクスを確認: https://console.cloud.google.com/cloudpubsub"
