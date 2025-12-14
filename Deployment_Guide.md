# Ultimate Deployment Guide: Timekeeper App

This guide works. Follow it exactly to fix the "Blank Screen" issue and deploy your app successfully.

**The "Blank Screen" Cause**: It happens because Vercel doesn't know your Supabase keys. We will fix that in Step 3.

---

## Step 1: Push Fixes to GitHub

I have added a `vercel.json` file. You must push this to GitHub first.

1.  Open your terminal.
2.  Run these commands:
    ```bash
    git add .
    git commit -m "fix: added vercel.json and fix fonts"
    git push
    ```

---

## Step 2: Setup Database (skip if done)

*If you already have a Supabase project from before, skip to Step 3.*

1.  Go to [Supabase Dashboard](https://supabase.com/dashboard) -> **New Project**.
2.  Name: `timekeeper`.
3.  **Password**: Generate a strong password and **SAVE IT**.
4.  Region: Choose your location (e.g., Mumbai).
5.  Wait for setup to finish.
6.  **Run SQL Schema**:
    *   Click **SQL Editor** (left sidebar).
    *   Click **New Query**.
    *   Copy everything from your local `complete_schema.sql`.
    *   Paste into Supabase and click **Run**.

---

## Step 3: Configure Vercel (CRITICAL STEP)

**This is where the blank screen is fixed.**

1.  Go to [Vercel Dashboard](https://vercel.com/dashboard).
2.  Click on your **Timekeeper** project.
3.  Go to **Settings** (top tab) -> **Environment Variables** (left sidebar).
4.  Current variables might be missing. Add them now:

    *   **Get keys from Supabase**:
        *   Go to Supabase -> **Project Settings** (Gear icon) -> **API**.

    *   **Add to Vercel**:

        | Key Name | Value Source |
        | :--- | :--- |
        | `VITE_SUPABASE_URL` | Copy **Project URL** from Supabase |
        | `VITE_SUPABASE_PUBLISHABLE_KEY` | Copy **anon public** key from Supabase |

5.  **IMPORTANT**: After adding variables, you MUST **Redeploy**.
    *   Go to **Deployments** tab (in Vercel).
    *   Click the **three dots (...)** next to the latest active deployment.
    *   Select **Redeploy**.
    *   Click **Redeploy** again.

---

## Step 4: Live URL Setup

1.  Once deployment finishes, copy your new Vercel domain (e.g., `https://timekeeper-xyz.vercel.app`).
2.  Go to **Supabase** -> **Authentication** -> **URL Configuration**.
3.  Paste your Vercel URL into **Site URL**.
4.  Click **Save**.

---

## Step 5: Verify

1.  Open your Vercel URL.
2.  It should load the Login screen (no more blank screen!).
3.  Try logging in.

### Still Blank?
If it is still blank:
1.  Right-click the page -> **Inspect**.
2.  Go to **Console** tab.
3.  Send me a screenshot of the red errors.
