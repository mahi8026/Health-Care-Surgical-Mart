# CI/CD Pipeline Setup Guide

This guide walks you through configuring the GitHub Actions CI/CD pipeline for Health Care Surgical Mart.

**Pipeline overview:**
- Every push/PR to `main` → runs 51 unit tests
- Tests pass + push to `main` → deploys backend to Render + frontend to Firebase
- Every PR → deploys a preview channel to Firebase with a unique URL

---

## Required GitHub Secrets

Add all of these in: **GitHub → Your Repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Required For | How to Get It |
|---|---|---|
| `RENDER_DEPLOY_HOOK` | Backend deploy | See Section 1 |
| `FIREBASE_SERVICE_ACCOUNT` | Frontend deploy + PR previews | See Section 2 |
| `VITE_API_URL` | Frontend build | `https://health-care-surgical-mart.onrender.com/api` |
| `VITE_FIREBASE_API_KEY` | Frontend build | Firebase Console → Project Settings → Web app config |
| `VITE_FIREBASE_APP_ID` | Frontend build | Firebase Console → Project Settings → Web app config |

---

## Section 1: Get the Render Deploy Hook URL

The deploy hook is a secret URL that triggers a new deployment when called with HTTP POST.

**Steps:**
1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Click on your backend service (e.g., `health-care-surgical-mart`)
3. Click **Settings** in the left sidebar
4. Scroll down to **Deploy Hook**
5. Click **Generate Deploy Hook** (if not already generated)
6. Copy the full URL — it looks like:
   ```
   https://api.render.com/deploy/srv-xxxxxxxxxxxxxxxxx?key=xxxxxxxxxxxxxxxxxxxxxxxx
   ```
7. Add it as GitHub secret `RENDER_DEPLOY_HOOK`

**Important:** This URL is a secret — anyone with it can trigger a deployment. Never commit it to code.

---

## Section 2: Generate Firebase Service Account for GitHub Actions

This is a **separate** service account from the one used for Firebase Admin SDK. It only needs Firebase Hosting permissions.

**Steps:**
1. Go to [Firebase Console](https://console.firebase.google.com/project/health-care-60ee6/settings/serviceaccounts/adminsdk)
2. Click **Project Settings** (gear icon) → **Service accounts** tab
3. At the bottom, click **Manage service account permissions** → opens Google Cloud Console
4. In Google Cloud Console, go to **IAM & Admin → Service Accounts**
5. Click **Create Service Account**:
   - Name: `github-actions-deploy`
   - Description: `GitHub Actions Firebase Hosting deployments`
6. Grant role: **Firebase Hosting Admin** (search for it)
7. Click **Done**
8. Click on the new service account → **Keys** tab → **Add Key → Create new key → JSON**
9. Download the JSON file
10. Copy the **entire JSON content** (not base64 — the raw JSON)
11. Add it as GitHub secret `FIREBASE_SERVICE_ACCOUNT` (paste the full JSON as the secret value)

**Alternative (easier):** Use the Firebase CLI to generate it:
```bash
firebase init hosting:github
```
This automatically creates the service account and adds the secret to your GitHub repo.

---

## Section 3: Add Secrets in GitHub Repository Settings

1. Go to your GitHub repository
2. Click **Settings** tab
3. In the left sidebar: **Secrets and variables → Actions**
4. Click **New repository secret** for each secret:

```
Name: RENDER_DEPLOY_HOOK
Value: https://api.render.com/deploy/srv-xxx?key=xxx

Name: FIREBASE_SERVICE_ACCOUNT
Value: { "type": "service_account", "project_id": "health-care-60ee6", ... }

Name: VITE_API_URL
Value: https://health-care-surgical-mart.onrender.com/api

Name: VITE_FIREBASE_API_KEY
Value: AIzaSyCGCOhLgDSooqfDzDKDfJhDjv0VaiauJrA

Name: VITE_FIREBASE_APP_ID
Value: 1:650347403792:web:d4ead8c6ce94991fbdc895
```

---

## Section 4: Verify the Pipeline After First Push

**Step 1: Push to main**
```bash
git add .github/workflows/
git commit -m "ci: add GitHub Actions CI/CD pipeline"
git push origin main
```

**Step 2: Watch the pipeline run**
1. Go to your GitHub repository
2. Click the **Actions** tab
3. You should see "CI/CD Pipeline" running
4. Click on it to see the 3 jobs: `test`, `deploy-backend`, `deploy-frontend`

**Step 3: Verify each job**

| Job | Expected result |
|---|---|
| `test` | ✅ Green — "51 passed" in logs |
| `deploy-backend` | ✅ Green — "Render deploy triggered successfully" |
| `deploy-frontend` | ✅ Green — "Deploy complete!" with Firebase URL |

**Step 4: Verify the deployments**
- Backend: `curl https://health-care-surgical-mart.onrender.com/health`
  - Expected: `{"status":"healthy",...}`
- Frontend: Open [https://health-care-60ee6.web.app](https://health-care-60ee6.web.app)
  - Expected: Login page loads

**Troubleshooting common issues:**

| Error | Cause | Fix |
|---|---|---|
| `RENDER_DEPLOY_HOOK: secret not found` | Secret not added | Add secret in GitHub Settings |
| `HTTP 401` on Render hook | Wrong deploy hook URL | Regenerate in Render dashboard |
| `Firebase: permission denied` | Wrong service account | Regenerate with Firebase Hosting Admin role |
| `VITE_API_URL undefined` | Secret not added | Add `VITE_API_URL` secret |
| Tests fail in CI but pass locally | Node version mismatch | Ensure `.nvmrc` says `20` |

---

## Section 5: How PR Previews Work

When you open a pull request targeting `main`:

1. **Tests run automatically** — PR is blocked if tests fail
2. **Preview is built** — frontend is built with production API URL
3. **Preview is deployed** — to a unique Firebase channel (e.g., `pr-42`)
4. **GitHub comment is posted** — automatically by `FirebaseExtended/action-hosting-deploy`

The comment looks like:
```
🚀 Deploy preview for Health Care Surgical Mart ready!
Visit: https://health-care-60ee6--pr-42-xxxxxxxx.web.app
```

**Accessing the preview:**
- Click the link in the PR comment
- The preview uses the production backend API
- Preview expires automatically after **7 days**
- Merging the PR deploys to the live channel

**Preview vs Live:**

| Channel | URL | Triggered by |
|---|---|---|
| Live | `https://health-care-60ee6.web.app` | Push to `main` |
| PR Preview | `https://health-care-60ee6--pr-N-xxx.web.app` | Pull request |

---

## Pipeline Architecture

```
Push to main
    │
    ▼
┌─────────────────────────────────────────┐
│  JOB 1: test (ubuntu-latest)            │
│  ─────────────────────────────────────  │
│  1. Checkout code                       │
│  2. Setup Node.js 20                    │
│  3. npm ci (server)                     │
│  4. npm test → 51 tests, ~7 seconds     │
│  5. Upload coverage artifact            │
└──────────────┬──────────────────────────┘
               │ (only if tests pass)
       ┌───────┴────────┐
       ▼                ▼
┌──────────────┐  ┌─────────────────────────────┐
│ JOB 2:       │  │ JOB 3:                      │
│ deploy-      │  │ deploy-frontend             │
│ backend      │  │ ─────────────────────────── │
│ ──────────── │  │ 1. Checkout code            │
│ 1. curl POST │  │ 2. Setup Node.js 20         │
│    Render    │  │ 3. npm ci (client)          │
│    hook      │  │ 4. npm run build            │
│ 2. Verify    │  │    (VITE_API_URL from secret)│
│    /health   │  │ 5. Firebase deploy → live   │
└──────────────┘  └─────────────────────────────┘
```

---

## Workflow Files

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | Main CI/CD pipeline (test + deploy on push to main) |
| `.github/workflows/pr-preview.yml` | PR preview deployments |

---

## Badge URLs

After setting up, update `README.md` with your actual repository path:

```markdown
[![CI/CD Pipeline](https://github.com/mahi8026/Health-Care-Surgical-Mart/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mahi8026/Health-Care-Surgical-Mart/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-51%2F51%20passing-brightgreen)](https://github.com/mahi8026/Health-Care-Surgical-Mart/actions)
[![Firebase Hosting](https://img.shields.io/badge/Firebase-Hosting-orange?logo=firebase)](https://health-care-60ee6.web.app)
[![Render](https://img.shields.io/badge/Render-Deployed-46E3B7?logo=render)](https://health-care-surgical-mart.onrender.com)
```

---

*Last updated: May 12, 2026*
