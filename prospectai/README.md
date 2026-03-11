# ProspectAI — Deploy to Vercel in 5 Minutes

## What's in this folder

```
prospectai/
├── api/
│   └── apollo.js        ← Serverless backend (calls Apollo API)
├── src/
│   └── index.html       ← Frontend (your prospecting bot)
├── vercel.json          ← Routing config
├── package.json
└── README.md
```

---

## Step 1 — Install Vercel CLI

Open your terminal and run:

```bash
npm install -g vercel
```

---

## Step 2 — Deploy

Navigate to this folder and run:

```bash
cd prospectai
vercel
```

Follow the prompts:
- **Set up and deploy?** → Y
- **Which scope?** → your personal account
- **Link to existing project?** → N
- **Project name?** → prospectai (or anything you like)
- **In which directory is your code?** → ./
- **Override settings?** → N

Vercel will give you a URL like: `https://prospectai-abc123.vercel.app`

---

## Step 3 — Add your Apollo API key (securely)

In your terminal:

```bash
vercel env add APOLLO_API_KEY
```

When prompted, paste your Apollo API key:
```
oZzZY5sUO4SwEGK9XZrzew
```

Select **Production**, **Preview**, and **Development** when asked which environments.

---

## Step 4 — Redeploy with the env variable

```bash
vercel --prod
```

---

## Step 5 — Done! 🎉

Open your Vercel URL and start prospecting with real Apollo data.

---

## Updating your Apollo key later

If you regenerate your Apollo key (recommended since it was shared in chat):

```bash
vercel env rm APOLLO_API_KEY
vercel env add APOLLO_API_KEY
vercel --prod
```

---

## Troubleshooting

- **"Search failed"** — Make sure you ran `vercel env add APOLLO_API_KEY` and redeployed
- **No leads returned** — Try broader titles like "VP Sales" or "Head of Growth"
- **Apollo credits** — Free plan = 50 credits/month. Each search uses ~1 credit.
