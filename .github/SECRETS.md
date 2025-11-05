# GitHub Secrets Configuration Guide

This document lists all GitHub Secrets required for CI/CD workflows.

## Required Secrets

### Frontend (Vercel Deployment)

| Secret Name                     | Description                     | Example                     |
| ------------------------------- | ------------------------------- | --------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL            | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key          | `eyJhbGc...`                |
| `CODECOV_TOKEN`                 | Codecov upload token (optional) | `abc123...`                 |

### Backend (Cloud Run Deployment)

| Secret Name             | Description                           | Example                                          |
| ----------------------- | ------------------------------------- | ------------------------------------------------ |
| `GCP_PROJECT_ID`        | Google Cloud Project ID               | `zoom-phone-feedback`                            |
| `GCP_SA_KEY`            | Service account JSON key              | `{"type": "service_account",...}`                |
| `GCP_PUBSUB_INVOKER_SA` | Pub/Sub invoker service account email | `pubsub-invoker@project.iam.gserviceaccount.com` |

### GCP Secret Manager Secrets

The following secrets should be stored in GCP Secret Manager (not GitHub Secrets):

- `OPENAI_API_KEY` - OpenAI API key for Whisper and GPT models
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `ZOOM_WEBHOOK_SECRET_TOKEN` - Zoom webhook verification token
- `ZOOM_ACCOUNT_ID` - Zoom account ID for API authentication
- `ZOOM_CLIENT_ID` - Zoom OAuth client ID
- `ZOOM_CLIENT_SECRET` - Zoom OAuth client secret
- `GCS_BUCKET_NAME` - Google Cloud Storage bucket name
- `GCP_PUBSUB_TOPIC` - Pub/Sub topic name

## How to Set GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**

## How to Set GCP Secret Manager Secrets

```bash
# Create a secret
gcloud secrets create SECRET_NAME --data-file=-

# Add a version to an existing secret
echo -n "SECRET_VALUE" | gcloud secrets versions add SECRET_NAME --data-file=-

# Grant Cloud Run service access to secrets
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/secretmanager.secretAccessor"
```

## How to Get GCP Service Account Key

```bash
# Create a service account (if not exists)
gcloud iam service-accounts create github-actions-deployer \
  --display-name="GitHub Actions Deployer"

# Grant necessary roles
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions-deployer@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create and download key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions-deployer@PROJECT_ID.iam.gserviceaccount.com

# Copy the content of github-actions-key.json and paste it into GCP_SA_KEY GitHub Secret
```

## Security Best Practices

1. **Never commit secrets to the repository**
2. **Use different secrets for development and production**
3. **Rotate secrets regularly**
4. **Use GCP Secret Manager for backend secrets** (not environment variables)
5. **Grant minimum necessary permissions** (principle of least privilege)
6. **Monitor secret access logs** in GCP Cloud Audit Logs

## Verification

After setting up secrets, you can verify by:

1. Pushing a commit to a branch and creating a PR
2. Check GitHub Actions tab for workflow runs
3. Ensure all steps pass successfully
4. Verify deployment in Cloud Run console

---

**Last Updated**: 2025-01-05
