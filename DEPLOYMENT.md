# Deployment Guide (Vercel)

Your application has been refactored to work perfectly on **Vercel** (Serverless) by moving the game save system to your browser.

## New Architecture: Client-Side Persistence
> [!NOTE]
> **Why?** Vercel servers are "ephemeral" (they restart often) and cannot save files to disk (`gamedata.json` would be deleted instantly).

- **Old Way**: Server saved `gamedata.json`.
- **New Way**: Your Browser saves to `localStorage`.
    - When you load the page, it loads data from YOUR device.
    - When you chat, it sends your data to the server temporarily to calculate XP.
    - The server sends back the updated data, and your browser saves it again.

**Result**: You can deploy this for free, and users will keep their own progress on their own devices!

## How to Deploy

### Option 1: Vercel CLI (Recommended)
1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. Run deploy command:
   ```bash
   vercel
   ```
3. Follow the prompts (Keep default settings).
4. **Environment Variables**:
   - Go to your Vercel Dashboard -> Settings -> Environment Variables.
   - Add `API_KEY` with your Groq API key.

### Option 2: Git Integration
1. Push this code to GitHub.
2. Go to [Vercel.com](https://vercel.com) -> "Add New Project".
3. Import your repository.
4. Add `API_KEY` in the specific "Environment Variables" section during import.
5. Click **Deploy**.

## Local Development
To run locally, just use:
```bash
npm start
```
It works exactly the same as the deployed version (using `localStorage`).
