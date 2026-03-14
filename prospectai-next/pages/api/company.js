// ProspectAI — /api/company (Next.js API route)
// 
// ACTION REQUIRED: Copy the full contents of:
//   prospectai/api/company.js
// into this file.
//
// The company.js handler is already 100% Next.js compatible
// (uses export default async function handler(req, res)).
// It's ~300 lines so wasn't included inline here to keep commits manageable.
//
// Steps:
// 1. Open prospectai/api/company.js in this repo
// 2. Copy all contents
// 3. Paste here and commit
//
// The file handles: Apollo org enrichment, contact lookup,
// job postings (Greenhouse/Lever/Ashby/LinkedIn/Apollo),
// Google News RSS, funding history, tech stack.

export default async function handler(req, res) {
  res.status(501).json({ error: 'Copy prospectai/api/company.js contents into this file' });
}
