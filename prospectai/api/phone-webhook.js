// Apollo phone webhook - receives async phone reveal callbacks
// Just acknowledges receipt; Apollo requires a valid 200 response
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  return res.status(200).json({ received: true });
}
