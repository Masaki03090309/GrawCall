# Zoom Verification Token取得方法

## 問題

現在、Zoom Proxy は正しく動作していますが、**Verification Token がまだ仮の値**のため、URL検証が失敗しています。

## ログ確認結果

✅ Zoom Proxy は正常に動作中:

- Zoomからの検証リクエストを受信
- plainToken: `4hmvQKUURr6f6txjxS80eA` を受信
- encrypted tokenを生成して返送

❌ しかし、Zoomは検証失敗と判定:

- Secret Managerのトークンが `temporary_token_will_be_replaced` (仮の値)
- Zoomが期待する正しいトークンではない

---

## 解決方法: 2つのアプローチ

### **アプローチ1: Zoom App Marketplaceで直接Verification Tokenを確認** (推奨)

1. **Zoom App Marketplace** にアクセス
   - https://marketplace.zoom.us/

2. **あなたのアプリ** を選択

3. **Features** タブ → **Event Subscriptions**

4. すでに追加した Event Subscription を確認

5. **Verification Token** が表示されているはず
   - 形式: `abc123def456ghi789...` (長い文字列)
   - これをコピー

6. コピーしたら、以下のコマンドを実行:

```bash
# Verification Tokenを更新 (YOUR_REAL_TOKENを実際の値に置き換え)
echo "YOUR_REAL_TOKEN" | gcloud secrets versions add ZOOM_WEBHOOK_SECRET_TOKEN --data-file=-
```

7. Zoom App Marketplaceで再度 **Validate** をクリック

---

### **アプローチ2: Event Subscriptionを一旦削除して再作成**

Verification Tokenが見つからない場合:

1. **Features** タブ → **Event Subscriptions**

2. 既存のEvent Subscriptionを **削除**

3. **Add Event Subscription** をクリック

4. 以下を入力:
   - **Subscription Name**: `Phone Recording Completed`
   - **Event notification endpoint URL**: `https://zoom-proxy-421962770379.asia-northeast1.run.app/webhook/zoom`

5. URLを入力すると、**Verification Token** が自動生成される

6. **Verification Token** をコピー (この時点でまだ保存しない)

7. コピーしたTokenでSecret Managerを更新:

```bash
# Verification Tokenを更新
echo "YOUR_VERIFICATION_TOKEN" | gcloud secrets versions add ZOOM_WEBHOOK_SECRET_TOKEN --data-file=-
```

8. 30秒待つ (Cloud Runが新しいSecretを読み込む)

9. Zoom App Marketplaceに戻り、**Validate** をクリック

10. 成功すると緑のチェックマーク ✅ が表示される

11. **Add Event Types** → `recording.completed` を選択

12. **Save**

---

## 確認コマンド

### Secret Managerの現在の値を確認

```bash
gcloud secrets versions access latest --secret=ZOOM_WEBHOOK_SECRET_TOKEN
```

現在は `temporary_token_will_be_replaced` と表示されるはずです。

### 更新後の確認

```bash
gcloud secrets versions access latest --secret=ZOOM_WEBHOOK_SECRET_TOKEN
```

正しいVerification Tokenが表示されればOK。

---

## トラブルシューティング

### Verification Tokenが見つからない

- Zoom App Marketplaceで Event Subscriptionを削除して再作成
- 新しく作成する際に自動生成される

### 更新後も検証が失敗する

```bash
# Cloud Runを再起動 (新しいSecretを確実に読み込む)
gcloud run services update zoom-proxy --region=asia-northeast1 --no-traffic

# 数秒待ってからトラフィックを戻す
gcloud run services update-traffic zoom-proxy --region=asia-northeast1 --to-latest
```

### ログで詳細確認

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=zoom-proxy" \
  --limit=10 --format=json
```

---

**Zoom App MarketplaceでVerification Tokenを見つけて、コピーしたら教えてください！**
