// api/suggest.js — Vercel Serverless Function
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

function buildPrompt(type, inventory, list) {
  if (type === "menus") {
    return `家にある食材：${inventory || "なし"}。
この食材を活かした今夜の家庭料理の献立を3つ提案してください。残り日数が少ない食材を優先。基本調味料は家にある前提。JSONのみで回答:
{"menus":[{"name":"料理名","uses":["使う家の食材"],"missing":["買い足しが必要な材料(なければ空配列)"],"point":"一言"}]}`;
  }
  if (type === "ideas") {
    return `家にある食材：${inventory || "なし"}。
いま買い物中で、買う予定：${list || "（リストは空）"}。
「あと1〜2品買い足せば、家の食材と合わせてこの料理が作れる」という提案を3つ。JSONのみで回答:
{"ideas":[{"buy":["買い足す物"],"dish":"作れる料理","withHome":["合わせて使う家の食材"]}]}`;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "サーバーに ANTHROPIC_API_KEY が設定されていません（Vercelの環境変数を確認）" });
  }

  const { type, inventory, list } = req.body || {};
  const prompt = buildPrompt(type, inventory, list);
  if (!prompt) return res.status(400).json({ error: "type は menus か ideas を指定してください" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const j = await r.json();
    if (j.error) {
      return res.status(502).json({ error: j.error.message || "Claude APIエラー" });
    }
    const text = (j.content || []).map((c) => (c.type === "text" ? c.text : "")).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return res.status(502).json({ error: "AI応答からJSONを抽出できませんでした" });
    return res.status(200).json(JSON.parse(m[0]));
  } catch (e) {
    return res.status(500).json({ error: e.message || "サーバー内部エラー" });
  }
}
