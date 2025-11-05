# API仕様書

**バージョン**: 1.0.0
**作成日**: 2025-01-15
**対象システム**: Zoom Phone フィードバックシステム 拡張版
**ベースURL**: `https://api.yourapp.com`

---

## 目次

1. [認証](#認証)
2. [共通仕様](#共通仕様)
3. [エンドポイント一覧](#エンドポイント一覧)
4. [認証API](#認証api)
5. [プロジェクト管理API](#プロジェクト管理api)
6. [プロンプト管理API](#プロンプト管理api)
7. [トークスクリプト管理API](#トークスクリプト管理api)
8. [学習資料管理API](#学習資料管理api)
9. [通話データAPI](#通話データapi)
10. [KPI API](#kpi-api)
11. [Webhook API](#webhook-api)

---

## 認証

### 認証方式

**Bearer Token (JWT)**

```http
Authorization: Bearer <access_token>
```

### トークン取得

Supabase Authを使用してトークンを取得します。

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password',
})

// data.session.access_token を使用
```

---

## 共通仕様

### リクエストヘッダー

```http
Content-Type: application/json
Authorization: Bearer <access_token>
```

### レスポンス形式

**成功時**:

```json
{
  "success": true,
  "data": { ... }
}
```

**エラー時**:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": { ... }
  }
}
```

### HTTPステータスコード

| コード | 説明                             |
| ------ | -------------------------------- |
| 200    | 成功                             |
| 201    | 作成成功                         |
| 204    | 削除成功（レスポンスボディなし） |
| 400    | リクエストエラー                 |
| 401    | 認証エラー                       |
| 403    | 権限エラー                       |
| 404    | リソースが見つからない           |
| 409    | 競合エラー                       |
| 422    | バリデーションエラー             |
| 500    | サーバーエラー                   |

### ページネーション

リスト取得APIは以下のクエリパラメータをサポート:

```
?page=1&limit=20&sort_by=created_at&order=desc
```

**レスポンス例**:

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "current_page": 1,
      "total_pages": 10,
      "total_items": 200,
      "limit": 20
    }
  }
}
```

---

## エンドポイント一覧

### 認証

- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト
- `GET /api/auth/user` - ユーザー情報取得

### プロジェクト管理

- `GET /api/projects` - プロジェクト一覧
- `POST /api/projects` - プロジェクト作成
- `GET /api/projects/:id` - プロジェクト詳細
- `PUT /api/projects/:id` - プロジェクト更新
- `DELETE /api/projects/:id` - プロジェクト削除
- `GET /api/projects/:id/members` - メンバー一覧
- `POST /api/projects/:id/members` - メンバー追加
- `DELETE /api/projects/:id/members/:userId` - メンバー削除

### プロンプト管理

- `GET /api/prompts` - プロンプト取得
- `POST /api/prompts` - プロンプト作成
- `PUT /api/prompts/:id` - プロンプト更新
- `GET /api/prompts/:id/history` - 変更履歴取得
- `POST /api/prompts/generate` - AIプロンプト生成

### トークスクリプト管理

- `GET /api/talk-scripts` - トークスクリプト取得
- `POST /api/talk-scripts` - トークスクリプト作成
- `PUT /api/talk-scripts/:id` - トークスクリプト更新
- `DELETE /api/talk-scripts/:id` - トークスクリプト削除
- `GET /api/talk-scripts/:id/history` - 変更履歴取得
- `POST /api/talk-scripts/import-pdf` - PDF取り込み
- `POST /api/talk-scripts/:id/hearing-items` - ヒアリング項目追加
- `PUT /api/talk-scripts/hearing-items/:itemId` - ヒアリング項目更新
- `DELETE /api/talk-scripts/hearing-items/:itemId` - ヒアリング項目削除

### 学習資料管理

- `GET /api/learning-materials` - 学習資料一覧
- `POST /api/learning-materials` - 学習資料アップロード
- `DELETE /api/learning-materials/:id` - 学習資料削除
- `GET /api/learning-materials/:id/preview` - プレビュー

### 通話データ

- `GET /api/calls` - 通話一覧
- `GET /api/calls/:id` - 通話詳細
- `GET /api/calls/:id/script-analysis` - トークスクリプト分析取得
- `PUT /api/calls/:id/appointment` - アポイント判定更新
- `PUT /api/calls/:id/valid-lead` - 有効リード判定更新
- `GET /api/calls/:id/audio-url` - 音声ファイルURL取得

### KPI

- `GET /api/kpi` - KPI取得
- `GET /api/kpi/ng-reasons` - NG理由集計

### Webhook

- `POST /webhook/zoom` - Zoom Webhook受信

---

## 認証API

### POST /api/auth/login

ログイン（Supabase Authを使用）

**リクエスト**:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "山田太郎",
      "role": "director"
    },
    "session": {
      "access_token": "eyJhbGc...",
      "refresh_token": "v1.Mr5...",
      "expires_in": 3600
    }
  }
}
```

---

### POST /api/auth/logout

ログアウト

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "message": "ログアウトしました"
  }
}
```

---

### GET /api/auth/user

現在のユーザー情報取得

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "山田太郎",
    "role": "director",
    "projects": [
      {
        "id": "uuid",
        "name": "プロジェクトA",
        "role": "director"
      }
    ]
  }
}
```

---

## プロジェクト管理API

### GET /api/projects

プロジェクト一覧取得

**クエリパラメータ**:

- `page`: ページ番号（デフォルト: 1）
- `limit`: 1ページあたりの件数（デフォルト: 20）

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "プロジェクトA",
        "slack_webhook_url": "https://hooks.slack.com/...",
        "member_count": 10,
        "created_at": "2025-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_items": 100,
      "limit": 20
    }
  }
}
```

---

### POST /api/projects

プロジェクト作成（オーナーのみ）

**リクエスト**:

```json
{
  "name": "新規プロジェクト",
  "slack_webhook_url": "https://hooks.slack.com/..."
}
```

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "新規プロジェクト",
    "slack_webhook_url": "https://hooks.slack.com/...",
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

---

### GET /api/projects/:id/members

プロジェクトメンバー一覧

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "name": "山田太郎",
        "email": "yamada@example.com",
        "role": "director",
        "zoom_user_id": "zoom123",
        "phone_number": "090-1234-5678",
        "created_at": "2025-01-15T10:00:00Z"
      }
    ]
  }
}
```

---

### POST /api/projects/:id/members

メンバー追加

**リクエスト**:

```json
{
  "user_id": "uuid",
  "role": "user",
  "zoom_user_id": "zoom123",
  "phone_number": "090-1234-5678"
}
```

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "role": "user",
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

---

## プロンプト管理API

### GET /api/prompts

プロンプト取得

**クエリパラメータ**:

- `project_id`: プロジェクトID（必須）
- `type`: プロンプトタイプ（connected/reception）

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "project_id": "uuid",
    "prompt_type": "connected",
    "content": "プロンプト本文...",
    "version": 5,
    "created_by": {
      "id": "uuid",
      "name": "山田太郎"
    },
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

---

### POST /api/prompts

プロンプト作成

**リクエスト**:

```json
{
  "project_id": "uuid",
  "prompt_type": "connected",
  "content": "新しいプロンプト本文...",
  "change_comment": "初回作成"
}
```

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "project_id": "uuid",
    "prompt_type": "connected",
    "content": "新しいプロンプト本文...",
    "version": 1,
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

---

### GET /api/prompts/:id/history

プロンプト変更履歴取得（過去10件）

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "uuid",
        "version": 5,
        "content": "プロンプト本文...",
        "change_comment": "ヒアリング項目を追加",
        "created_by": {
          "id": "uuid",
          "name": "山田太郎"
        },
        "created_at": "2025-01-15T10:00:00Z"
      }
    ]
  }
}
```

---

### POST /api/prompts/generate

AIプロンプト生成（音声入力から）

**リクエスト**:

```json
{
  "audio_base64": "data:audio/wav;base64,...",
  "prompt_type": "connected"
}
```

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "transcription": "文字起こしテキスト...",
    "generated_prompt": "生成されたプロンプト..."
  }
}
```

---

## トークスクリプト管理API

### GET /api/talk-scripts

トークスクリプト取得

**クエリパラメータ**:

- `project_id`: プロジェクトID（必須）

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "project_id": "uuid",
    "version": 3,
    "opening_script": "お世話になっております...",
    "proposal_script": "弊社のサービスは...",
    "closing_script": "それでは、来週火曜日に...",
    "hearing_items": [
      {
        "id": "uuid",
        "item_name": "現在の課題",
        "item_script": "御社の現在の課題をお聞かせいただけますか？",
        "is_default": true,
        "display_order": 1
      },
      {
        "id": "uuid",
        "item_name": "予算感",
        "item_script": "ご予算はどのくらいをお考えでしょうか？",
        "is_default": false,
        "display_order": 2
      }
    ],
    "created_by": {
      "id": "uuid",
      "name": "山田太郎"
    },
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

---

### POST /api/talk-scripts

トークスクリプト作成

**リクエスト**:

```json
{
  "project_id": "uuid",
  "opening_script": "お世話になっております...",
  "proposal_script": "弊社のサービスは...",
  "closing_script": "それでは、来週火曜日に...",
  "hearing_items": [
    {
      "item_name": "現在の課題",
      "item_script": "御社の現在の課題をお聞かせいただけますか？",
      "is_default": true,
      "display_order": 1
    }
  ],
  "change_comment": "初回作成"
}
```

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "version": 1,
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

---

### POST /api/talk-scripts/import-pdf

PDF取り込み（GPT-5による自動フェーズ判定）

**リクエスト**:

```json
{
  "project_id": "uuid",
  "pdf_base64": "data:application/pdf;base64,...",
  "filename": "talk_script.pdf"
}
```

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "extracted_text": "全体の抽出テキスト...",
    "opening_script": "お世話になっております...",
    "proposal_script": "弊社のサービスは...",
    "closing_script": "それでは、来週火曜日に...",
    "hearing_items": [
      {
        "item_name": "現在の課題",
        "item_script": "御社の現在の課題をお聞かせいただけますか？",
        "display_order": 1
      }
    ]
  }
}
```

---

### POST /api/talk-scripts/:id/hearing-items

ヒアリング項目追加

**リクエスト**:

```json
{
  "item_name": "導入時期",
  "item_script": "いつ頃の導入をお考えですか？",
  "display_order": 3
}
```

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "item_name": "導入時期",
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

---

## 学習資料管理API

### GET /api/learning-materials

学習資料一覧

**クエリパラメータ**:

- `project_id`: プロジェクトID（必須）
- `material_type`: 資料タイプ（detail/case_study）

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "project_id": "uuid",
        "material_type": "detail",
        "file_name": "product_detail.pdf",
        "file_type": "pdf",
        "file_url": "https://storage.googleapis.com/...",
        "file_size_mb": 2.5,
        "uploaded_by": {
          "id": "uuid",
          "name": "山田太郎"
        },
        "created_at": "2025-01-15T10:00:00Z"
      }
    ]
  }
}
```

---

### POST /api/learning-materials

学習資料アップロード

**リクエスト**:

```json
{
  "project_id": "uuid",
  "material_type": "case_study",
  "file_name": "case_study_logistics.pdf",
  "file_base64": "data:application/pdf;base64,..."
}
```

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "file_url": "https://storage.googleapis.com/...",
    "embedding_count": 25,
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

---

## 通話データAPI

### GET /api/calls

通話一覧取得

**クエリパラメータ**:

- `project_id`: プロジェクトID
- `user_id`: ユーザーID（営業担当者）
- `status`: 通話状態（connected/reception/no_conversation）
- `date_from`: 開始日（YYYY-MM-DD）
- `date_to`: 終了日（YYYY-MM-DD）
- `page`: ページ番号
- `limit`: 1ページあたりの件数

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "project_id": "uuid",
        "project_name": "プロジェクトA",
        "user_id": "uuid",
        "user_name": "山田太郎",
        "zoom_call_id": "zoom123",
        "direction": "outbound",
        "caller_number": "090-1234-5678",
        "callee_number": "03-1234-5678",
        "duration_seconds": 245,
        "call_time": "2025-01-15T14:30:00Z",
        "status": "connected",
        "overall_match_rate": 76.5,
        "appointment_gained": true,
        "appointment_confirmed": true,
        "valid_lead": true,
        "ng_reason": null,
        "created_at": "2025-01-15T14:35:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 10,
      "total_items": 200,
      "limit": 20
    }
  }
}
```

---

### GET /api/calls/:id

通話詳細取得

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "project_id": "uuid",
    "user_id": "uuid",
    "zoom_call_id": "zoom123",
    "direction": "outbound",
    "caller_number": "090-1234-5678",
    "callee_number": "03-1234-5678",
    "duration_seconds": 245,
    "call_time": "2025-01-15T14:30:00Z",
    "status": "connected",
    "status_confidence": 95.5,
    "feedback_text": "フィードバック本文...",
    "prompt_version": {
      "id": "uuid",
      "version": 5
    },
    "talk_script_analysis": {
      "overall_match_rate": 76.5,
      "phase_match_rates": {
        "opening": 85,
        "hearing": 68,
        "proposal": 78,
        "closing": 73
      },
      "hearing_item_coverage": {
        "現在の課題": {
          "covered": true,
          "match_rate": 82
        },
        "予算感": {
          "covered": false,
          "match_rate": 0
        }
      }
    },
    "appointment_gained": true,
    "appointment_confirmed": true,
    "valid_lead": true,
    "valid_lead_confirmed": true,
    "ng_reason": null,
    "emotion_analysis_url": "https://storage.googleapis.com/.../emotion.json",
    "created_at": "2025-01-15T14:35:00Z"
  }
}
```

---

### GET /api/calls/:id/script-analysis

トークスクリプト分析詳細取得

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "overall_match_rate": 76.5,
    "phase_match_rates": {
      "opening": 85,
      "hearing": 68,
      "proposal": 78,
      "closing": 73
    },
    "hearing_item_coverage": {
      "現在の課題": {
        "covered": true,
        "match_rate": 82,
        "script_text": "御社の現在の課題をお聞かせいただけますか？",
        "actual_text": "今、何か困っていることってありますか？",
        "evaluation": "表現は異なるが、意図は一致"
      },
      "予算感": {
        "covered": false,
        "match_rate": 0,
        "script_text": "ご予算はどのくらいをお考えでしょうか？",
        "actual_text": null,
        "evaluation": "未カバー。次回は必ず確認しましょう。"
      }
    },
    "hearing_item_coverage_rate": 75.0
  }
}
```

---

### PUT /api/calls/:id/appointment

アポイント判定更新（ユーザー確認）

**リクエスト**:

```json
{
  "appointment_confirmed": true
}
```

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "appointment_confirmed": true,
    "updated_at": "2025-01-15T15:00:00Z"
  }
}
```

---

### GET /api/calls/:id/audio-url

音声ファイルのSigned URL取得

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "audio_url": "https://storage.googleapis.com/...?X-Goog-Signature=...",
    "transcript_url": "https://storage.googleapis.com/...?X-Goog-Signature=...",
    "expires_at": "2025-01-15T16:00:00Z"
  }
}
```

---

## KPI API

### GET /api/kpi

KPI取得

**クエリパラメータ**:

- `project_id`: プロジェクトID
- `user_id`: ユーザーID（オプション）
- `period`: 集計期間（daily/weekly/monthly/custom）
- `date_from`: 開始日（customの場合）
- `date_to`: 終了日（customの場合）

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "period": "monthly",
    "date_from": "2025-01-01",
    "date_to": "2025-01-31",
    "kpi": {
      "call_count": 1300,
      "connected_count": 650,
      "reception_count": 450,
      "no_conversation_count": 200,
      "connection_rate": 50.0,
      "appointment_count": 130,
      "valid_lead_count": 195
    },
    "daily_trend": [
      {
        "date": "2025-01-15",
        "call_count": 45,
        "connected_count": 22,
        "connection_rate": 48.9
      }
    ]
  }
}
```

---

### GET /api/kpi/ng-reasons

NG理由集計

**クエリパラメータ**:

- `project_id`: プロジェクトID（必須）
- `date_from`: 開始日
- `date_to`: 終了日

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "total_ng_count": 450,
    "ng_reasons": [
      {
        "id": "uuid",
        "reason_name": "価格が理由",
        "count": 203,
        "percentage": 45.1,
        "trend": "+15%"
      },
      {
        "id": "uuid",
        "reason_name": "タイミングが悪い",
        "count": 135,
        "percentage": 30.0,
        "trend": "-5%"
      }
    ],
    "time_series": [
      {
        "date": "2025-01-15",
        "ng_reasons": {
          "価格が理由": 5,
          "タイミングが悪い": 3
        }
      }
    ]
  }
}
```

---

## Webhook API

### POST /webhook/zoom

Zoom Webhook受信

**リクエスト**:

```json
{
  "event": "recording.completed",
  "payload": {
    "object": {
      "id": "zoom_recording_id",
      "uuid": "zoom_call_id",
      "host_id": "zoom_user_id",
      "topic": "Call Recording",
      "start_time": "2025-01-15T14:30:00Z",
      "duration": 245,
      "recording_files": [
        {
          "id": "file_id",
          "recording_start": "2025-01-15T14:30:00Z",
          "recording_end": "2025-01-15T14:34:05Z",
          "file_type": "MP4",
          "file_size": 12345678,
          "download_url": "https://zoom.us/rec/download/..."
        }
      ]
    }
  }
}
```

**レスポンス**:

```json
{
  "success": true,
  "data": {
    "message": "Webhook received and processing started",
    "call_id": "uuid"
  }
}
```

---

## エラーコード一覧

| コード                 | 説明                     |
| ---------------------- | ------------------------ |
| `UNAUTHORIZED`         | 認証エラー               |
| `FORBIDDEN`            | 権限エラー               |
| `NOT_FOUND`            | リソースが見つからない   |
| `VALIDATION_ERROR`     | バリデーションエラー     |
| `DUPLICATE_ENTRY`      | 重複エラー               |
| `PROJECT_MEMBER_LIMIT` | プロジェクトメンバー上限 |
| `FILE_TOO_LARGE`       | ファイルサイズ超過       |
| `INVALID_FILE_TYPE`    | 無効なファイルタイプ     |
| `AI_PROCESSING_ERROR`  | AI処理エラー             |
| `EXTERNAL_API_ERROR`   | 外部APIエラー            |

**エラーレスポンス例**:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "バリデーションエラーが発生しました",
    "details": {
      "fields": {
        "email": "メールアドレスの形式が正しくありません",
        "phone_number": "電話番号は必須です"
      }
    }
  }
}
```

---

## レート制限

- **認証API**: 5リクエスト/分
- **その他API**: 100リクエスト/分

レート制限超過時のレスポンス:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "レート制限を超過しました。しばらく待ってから再試行してください。",
    "details": {
      "retry_after": 60
    }
  }
}
```

---

**以上**
