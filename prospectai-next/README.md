# ProspectAI — Next.js App

Full Next.js rewrite of ProspectAI. Your original app lives in `/prospectai` and is untouched.

## File Structure

```
prospectai-next/
├── pages/
│   ├── _app.js          # Global styles wrapper
│   ├── index.js         # Main layout + tab routing
│   └── api/
│       ├── apollo.js    # Lead search + enrichment (Apollo.io)
│       ├── hubspot.js   # CRM upsert (HubSpot)
│       ├── company.js   # Company intel (copy from ../../../prospectai/api/company.js)
│       └── send-email.js # Multi-provider email (O365, Gmail, SendGrid, Mailgun, custom)
├── components/
│   ├── LeadCard.js      # Shared lead card (used by all tabs)
│   ├── FindLeads.js     # Find Leads tab
│   ├── CompanyIntel.js  # Company Intel tab
│   ├── BulkProspector.js # Bulk Prospector tab
│   ├── JobChanges.js    # Job Changes tab
│   ├── PeopleLookup.js  # People Lookup tab
│   ├── Credits.js       # Credits & Usage tab
│   ├── LookalikSearch.js # Lookalike Search tab
│   └── Settings.js      # Settings + Integrations tab
├── lib/
│   └── utils.js         # Shared formatting + localStorage helpers
├── styles/
│   └── globals.css      # Full dark theme (exact match to original)
├── package.json
└── next.config.js
```

## ⚠️ One Manual Step Required

Copy the full Company Intel API handler:
```bash
# Copy company.js from old app into Next.js API routes
cp prospectai/api/company.js prospectai-next/pages/api/company.js
```

The file is ~300 lines and already Next.js compatible.

## Setup & Run

```bash
# 1. Navigate to the app
cd prospectai-next

# 2. Install dependencies
npm install

# 3. Create environment variables
cp .env.example .env.local
# Edit .env.local and add your keys

# 4. Run development server
npm run dev
# Opens at http://localhost:3000

# 5. Build for production
npm run build
npm start
```

## Environment Variables

Create a `.env.local` file (never commit this):

```env
# Required
APOLLO_API_KEY=your_apollo_api_key
HUBSPOT_ACCESS_TOKEN=your_hubspot_token

# Email (choose one provider)
EMAIL_PROVIDER=office365    # office365 | gmail | sendgrid | mailgun | custom
EMAIL_USER=sender@yourcompany.com
EMAIL_PASS=your_password_or_app_password
EMAIL_FROM_NAME=ProspectAI

# For Gmail: use an App Password (not your Google password)
# Create at: myaccount.google.com/apppasswords

# For SendGrid: set EMAIL_PASS to your API key, EMAIL_USER to "apikey"

# For custom SMTP
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
```

## Deploy to AWS Amplify

1. Push this repo to GitHub (already done)
2. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
3. Click **New App → Host web app**
4. Connect your GitHub repo → select branch `main`
5. Set **Root directory** to `prospectai-next`
6. Add environment variables (APOLLO_API_KEY, HUBSPOT_ACCESS_TOKEN, etc.)
7. Deploy — Amplify auto-detects Next.js and configures everything

## Deploy to EC2 / ECS

```bash
# On your server
git clone https://github.com/Dlyle2671/prospectai
cd prospectai/prospectai-next
npm install
npm run build

# Set environment variables
export APOLLO_API_KEY=...
export HUBSPOT_ACCESS_TOKEN=...

# Start with PM2 (recommended)
npm install -g pm2
pm2 start npm --name prospectai -- start
pm2 save
```

## What Changed vs Original

| Feature | Original | Next.js |
|---------|----------|---------|
| State | Injected JS, resets on refresh | React useState, persists properly |
| Routing | Manual tab switching | Clean React conditionals |
| CSS | Inline `<style>` tags | globals.css + CSS classes |
| API routes | Same — already compatible | Copied verbatim |
| Persistence | localStorage (manual) | localStorage via utils.js helpers |
| Email | Office 365 only | O365, Gmail, SendGrid, Mailgun, custom |

## Original App

Your original app at `/prospectai` is **completely untouched** and still deployed at your Vercel URL. Switch over whenever you're ready.
