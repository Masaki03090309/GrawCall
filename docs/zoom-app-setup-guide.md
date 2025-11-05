# Zoom Phone App セットアップガイド

このガイドでは、Zoom Phone Feedback Systemで使用するZoom Phone Appの詳細な設定方法を説明します。

---

## 前提条件

- Zoom Account (Pro以上のプラン)
- Zoom Phone ライセンス
- 管理者権限

---

## 1. App作成

### 1.1 Zoom App Marketplaceにアクセス

1. https://marketplace.zoom.us/ にアクセス
2. 右上の **Develop** → **Build App** をクリック
3. **Server-to-Server OAuth** を選択
4. **Create** をクリック

---

## 2. Information (基本情報)

### 2.1 Basic Information

| フィールド                        | 入力内容                                                                                                                                                                                                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **App Name**                      | `Zoom Phone Feedback System`                                                                                                                                                                                                                                                                       |
| **Short Description**             | `AI-powered feedback system for Zoom Phone call recordings`                                                                                                                                                                                                                                        |
| **Long Description**              | `This app automatically transcribes Zoom Phone call recordings, analyzes conversation quality using AI, and provides actionable feedback to improve sales performance. Features include: GPT-powered status detection, talk script matching, RAG-enhanced feedback, and NG reason trend analysis.` |
| **Company Name**                  | あなたの会社名 (例: `Your Company Inc.`)                                                                                                                                                                                                                                                           |
| **Developer Name**                | あなたの名前                                                                                                                                                                                                                                                                                       |
| **Developer Contact Information** | あなたのメールアドレス                                                                                                                                                                                                                                                                             |

### 2.2 App Credentials

この画面で以下が表示されます（すでに取得済み）:

- **Account ID**: `GIsBftwWTEi_hJ4NQVB3mQ` ✅
- **Client ID**: `yxkXzh1vTpKVeIsYgGgTw` ✅
- **Client Secret**: `sG856fvDGxKraXaSG3TBGhCWyn2vqBga` ✅

**重要**: これらは絶対に公開しないでください！

### 2.3 Information to Users (オプション)

| フィールド            | 入力内容                             |
| --------------------- | ------------------------------------ |
| **Developer Website** | あなたの会社のWebサイト (オプション) |
| **Terms of Use**      | 利用規約URL (オプション)             |
| **Privacy Policy**    | プライバシーポリシーURL (オプション) |
| **Support Link**      | サポート窓口URL (オプション)         |

内部利用のアプリなので、これらはスキップ可能です。

---

## 3. Scopes (権限設定)

**Scopes** タブで以下の権限を追加します:

### 3.1 Phone Scopes (必須)

| Scope                                       | 説明                   | 必要性     |
| ------------------------------------------- | ---------------------- | ---------- |
| `phone:read:list_phone_numbers:admin`       | 電話番号一覧の読み取り | 必須       |
| `phone:read:call_log:admin`                 | 通話ログの読み取り     | 必須       |
| `phone:read:recording:admin`                | 録音ファイルの読み取り | **最重要** |
| `phone_recording:read:list_recording:admin` | 録音リストの読み取り   | 必須       |

### 3.2 追加で推奨されるScopes

| Scope                   | 説明                   | 必要性 |
| ----------------------- | ---------------------- | ------ |
| `phone:read:user:admin` | ユーザー情報の読み取り | 推奨   |
| `phone:read:admin`      | Zoom Phone管理者権限   | 推奨   |

### 3.3 Scopesの追加手順

1. **Scopes** タブをクリック
2. **+ Add Scopes** ボタンをクリック
3. 検索バーで `phone:read:recording` を検索
4. チェックボックスにチェック
5. 上記の全てのScopesを追加
6. **Done** → **Continue** をクリック

---

## 4. Features (機能設定)

### 4.1 Event Subscriptions (Webhook設定)

#### 4.1.1 有効化

1. **Features** タブをクリック
2. **Event Subscriptions** セクションで **Add Event Subscription** をクリック

#### 4.1.2 Subscription設定

| フィールド                          | 入力内容                                                               |
| ----------------------------------- | ---------------------------------------------------------------------- |
| **Subscription Name**               | `Phone Recording Completed`                                            |
| **Event notification endpoint URL** | `https://zoom-proxy-421962770379.asia-northeast1.run.app/webhook/zoom` |

#### 4.1.3 Verification Token

- URLを入力すると、Zoomが **Verification Token** を自動生成します
- この **Verification Token** をコピーして保存してください
- これを後で `ZOOM_WEBHOOK_SECRET_TOKEN` として設定します

#### 4.1.4 Event Types選択

**Add Event Types** をクリックして以下を選択:

| Event Type                       | 説明             | 選択          |
| -------------------------------- | ---------------- | ------------- |
| `recording.completed`            | 録音完了時       | ✅ **必須**   |
| `recording.transcript_completed` | 文字起こし完了時 | ⭕ オプション |

**注意**: このシステムでは独自のWhisper APIを使うため、`recording.transcript_completed` は不要です。

#### 4.1.5 保存

- **Save** をクリック
- Zoomが自動的にWebhook URLを検証します
- 成功すると緑のチェックマークが表示されます

---

## 5. Activation (アクティベート)

### 5.1 アプリのアクティベート

1. **Activation** タブをクリック
2. 全ての設定が完了していることを確認
3. **Activate your app** ボタンをクリック

### 5.2 承認

- 社内アプリとして承認されます
- 管理者承認が必要な場合があります

---

## 6. Webhook Secret Token設定 (GCP Secret Manager)

Zoom App MarketplaceでVerification Tokenを取得したら、以下のコマンドを実行:

### 6.1 Secret Managerに保存

```bash
# Verification Tokenを保存 (YOUR_VERIFICATION_TOKENを実際のトークンに置き換え)
gcloud secrets create ZOOM_WEBHOOK_SECRET_TOKEN \
  --data-file=- --replication-policy=automatic <<< "YOUR_VERIFICATION_TOKEN"
```

### 6.2 権限付与

```bash
# Zoom Proxyサービスアカウントに権限付与
gcloud secrets add-iam-policy-binding ZOOM_WEBHOOK_SECRET_TOKEN \
  --member=serviceAccount:421962770379-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

### 6.3 Cloud Runサービス更新

```bash
# Zoom Proxyサービスを更新
gcloud run services update zoom-proxy \
  --region=asia-northeast1 \
  --update-secrets=ZOOM_WEBHOOK_SECRET_TOKEN=ZOOM_WEBHOOK_SECRET_TOKEN:latest
```

---

## 7. 動作確認

### 7.1 Webhook検証

1. Zoom App Marketplace の Event Subscriptions画面で緑のチェックマークを確認
2. Cloud Runログで検証リクエストを確認:

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=zoom-proxy" \
  --limit=10 --format=json
```

### 7.2 テスト通話

1. **Zoom Phoneで通話を開始**
2. **録音を有効化** (自動録音設定がある場合は自動)
3. **通話を終了**
4. **録音処理完了を待つ** (数分かかる場合があります)
5. **Backend Processorログを確認**:

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=backend-processor" \
  --limit=50 --format=json
```

### 7.3 Supabaseでデータ確認

1. Supabase Dashboard → Table Editor → `calls`
2. 新しいレコードが作成されているか確認

### 7.4 Slack通知確認

- 設定したSlack Webhookにメッセージが届くか確認

---

## 8. トラブルシューティング

### Webhook検証が失敗する

**原因**:

- Cloud Runサービスが起動していない
- ZOOM_WEBHOOK_SECRET_TOKENが正しく設定されていない
- ファイアウォールでブロックされている

**解決方法**:

```bash
# Cloud Runサービスの状態確認
gcloud run services describe zoom-proxy --region=asia-northeast1

# ログ確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=zoom-proxy" \
  --limit=20
```

### 録音完了イベントが届かない

**原因**:

- Event Typesで `recording.completed` が選択されていない
- Zoom Phoneの録音設定が無効
- Scopesが不足している

**解決方法**:

1. Zoom App Marketplace → Features → Event Subscriptions で設定確認
2. Zoom Phone設定で録音が有効になっているか確認
3. Scopes タブで `phone:read:recording:admin` が追加されているか確認

### 音声ダウンロードが失敗する

**原因**:

- Zoom OAuthトークンの期限切れ
- Scopesが不足している

**解決方法**:

```bash
# Backend Processorログで詳細確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=backend-processor AND textPayload:\"Error\"" \
  --limit=20
```

---

## 9. チェックリスト

設定完了後、以下を確認してください:

- [ ] App Name設定完了
- [ ] Account ID, Client ID, Client Secret取得済み
- [ ] Scopes追加完了 (`phone:read:recording:admin` など)
- [ ] Event Subscriptions設定完了
- [ ] Verification Token取得済み
- [ ] ZOOM_WEBHOOK_SECRET_TOKEN設定完了
- [ ] Webhook検証成功 (緑のチェックマーク)
- [ ] App Activation完了
- [ ] テスト通話で動作確認完了

---

## 10. 参考リンク

- [Zoom Server-to-Server OAuth](https://developers.zoom.us/docs/internal-apps/s2s-oauth/)
- [Zoom Phone API Reference](https://developers.zoom.us/docs/api/rest/reference/phone/)
- [Zoom Webhooks](https://developers.zoom.us/docs/api/rest/webhook-reference/)

---

**以上でZoom Phone Appのセットアップは完了です!**
