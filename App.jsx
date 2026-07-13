import { useState, useEffect, useCallback, useRef } from "react";

// ================= utilities =================
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const addDays = (dateStr, n) => {
  const d = new Date(dateStr); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const daysSince = (s) => (s ? daysBetween(s, todayStr()) : 0);
const uid = () => Math.random().toString(36).slice(2, 9);
const r1 = (n) => Math.round(n * 10) / 10;
// 0.5刻みが自然な単位（半玉・半本など）。それ以外は1単位で数える
const HALF_UNITS = ["玉", "本", "kg", "丁", "斤", "袋"];
const stepOf = (unit) => (HALF_UNITS.includes(unit) ? 0.5 : 1);
const fmtQ = (v, unit) => (stepOf(unit) === 1 ? Math.max(0, Math.round(v)) : r1(v));
const kataToHira = (s) => (s || "").replace(/[\u30a1-\u30f6]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60));
const norm = (s) => kataToHira((s || "").trim().toLowerCase().replace(/\s+/g, ""));

// ================= 在庫推定モデル =================
// item = {id, name, unit, cat, stock, stockDate, purchasedSince, ratePerDay, buyQty, kind, snoozeUntil}
const estStock = (it) => Math.max(0, r1(it.stock + (it.purchasedSince || 0) - it.ratePerDay * daysSince(it.stockDate)));
const daysToZero = (it) => (it.ratePerDay <= 0 ? 99 : Math.floor(estStock(it) / it.ratePerDay));

// ================= 食材・日用品カタログ =================
// [表示名, よみ(ひらがな), 単位, カテゴリ]
const CATALOG = [
  // [表示名, よみ, 単位, カテゴリ, グループ, 常備?]
  // --- 野菜 🥬 ---
  ["トマト","とまと","個","food","veg"],["ミニトマト","みにとまと","パック","food","veg"],["きゅうり","きゅうり","本","food","veg"],["なす","なす","本","food","veg"],["ピーマン","ぴーまん","個","food","veg"],["パプリカ","ぱぷりか","個","food","veg"],["キャベツ","きゃべつ","玉","food","veg"],["レタス","れたす","玉","food","veg"],["白菜","はくさい","玉","food","veg"],["ほうれん草","ほうれんそう","束","food","veg"],["小松菜","こまつな","束","food","veg"],["水菜","みずな","束","food","veg"],["ニラ","にら","束","food","veg"],["長ネギ","ながねぎ","本","food","veg"],["玉ねぎ","たまねぎ","個","food","veg"],["じゃがいも","じゃがいも","個","food","veg"],["さつまいも","さつまいも","本","food","veg"],["里芋","さといも","個","food","veg"],["にんじん","にんじん","本","food","veg"],["大根","だいこん","本","food","veg"],["かぶ","かぶ","個","food","veg"],["ごぼう","ごぼう","本","food","veg"],["れんこん","れんこん","節","food","veg"],["ブロッコリー","ぶろっこりー","株","food","veg"],["カリフラワー","かりふらわー","株","food","veg"],["アスパラガス","あすぱらがす","束","food","veg"],["もやし","もやし","袋","food","veg"],["しめじ","しめじ","袋","food","veg"],["えのき","えのき","袋","food","veg"],["しいたけ","しいたけ","個","food","veg"],["まいたけ","まいたけ","袋","food","veg"],["エリンギ","えりんぎ","本","food","veg"],["にんにく","にんにく","玉","food","veg"],["しょうが","しょうが","個","food","veg"],["大葉","おおば","枚","food","veg"],["みょうが","みょうが","個","food","veg"],["オクラ","おくら","袋","food","veg"],["ズッキーニ","ずっきーに","本","food","veg"],["かぼちゃ","かぼちゃ","個","food","veg"],["とうもろこし","とうもろこし","本","food","veg"],["枝豆","えだまめ","袋","food","veg"],["豆苗","とうみょう","袋","food","veg"],["セロリ","せろり","本","food","veg"],["アボカド","あぼかど","個","food","veg"],
  // --- 果物 🍎 ---
  ["りんご","りんご","個","food","fruit"],["バナナ","ばなな","本","food","fruit"],["みかん","みかん","個","food","fruit"],["いちご","いちご","パック","food","fruit"],["ぶどう","ぶどう","房","food","fruit"],["梨","なし","個","food","fruit"],["桃","もも","個","food","fruit"],["キウイ","きうい","個","food","fruit"],["レモン","れもん","個","food","fruit"],["オレンジ","おれんじ","個","food","fruit"],["グレープフルーツ","ぐれーぷふるーつ","個","food","fruit"],["パイナップル","ぱいなっぷる","個","food","fruit"],["柿","かき","個","food","fruit"],["ブルーベリー","ぶるーべりー","パック","food","fruit"],
  // --- 肉 🥩 ---
  ["鶏むね肉","とりむねにく","枚","food","meat"],["鶏もも肉","とりももにく","枚","food","meat"],["ささみ","ささみ","本","food","meat"],["手羽元","てばもと","本","food","meat"],["手羽先","てばさき","本","food","meat"],["豚こま切れ","ぶたこまぎれ","パック","food","meat"],["豚バラ","ぶたばら","パック","food","meat"],["豚ロース","ぶたろーす","枚","food","meat"],["牛こま切れ","ぎゅうこまぎれ","パック","food","meat"],["牛バラ","ぎゅうばら","パック","food","meat"],["ステーキ肉","すてーきにく","枚","food","meat"],["合いびき肉","あいびきにく","パック","food","meat"],["豚ひき肉","ぶたひきにく","パック","food","meat"],["鶏ひき肉","とりひきにく","パック","food","meat"],["ベーコン","べーこん","パック","food","meat"],["ハム","はむ","パック","food","meat"],["ソーセージ","そーせーじ","袋","food","meat"],["鶏レバー","とりればー","パック","food","meat"],
  // --- 魚介 🐟 ---
  ["鮭","さけ","切身","food","fish"],["サバ","さば","切身","food","fish"],["さんま","さんま","尾","food","fish"],["アジ","あじ","尾","food","fish"],["ぶり","ぶり","切身","food","fish"],["たら","たら","切身","food","fish"],["まぐろ刺身","まぐろさしみ","パック","food","fish"],["サーモン刺身","さーもんさしみ","パック","food","fish"],["しらす","しらす","パック","food","fish"],["ちくわ","ちくわ","本","food","fish"],["かまぼこ","かまぼこ","本","food","fish"],["はんぺん","はんぺん","枚","food","fish"],["えび","えび","パック","food","fish"],["いか","いか","杯","food","fish"],["たこ","たこ","パック","food","fish"],["あさり","あさり","パック","food","fish"],["ツナ缶","つなかん","缶","food","fish"],["サバ缶","さばかん","缶","food","fish"],
  // --- 卵 🥚・牛乳 🥛・乳製品・大豆 🫘 ---
  ["卵","たまご","個","food","egg"],["牛乳","ぎゅうにゅう","本","food","milk"],["ヨーグルト","よーぐると","個","food","dairy"],["チーズ","ちーず","袋","food","dairy"],["バター","ばたー","箱","food","dairy"],["生クリーム","なまくりーむ","本","food","dairy"],["豆乳","とうにゅう","本","food","dairy"],["豆腐","とうふ","丁","food","soy"],["納豆","なっとう","パック","food","soy"],["油揚げ","あぶらあげ","枚","food","soy"],["厚揚げ","あつあげ","枚","food","soy"],
  // --- 主食・粉 🍚 ---
  ["米","こめ","kg","food","staple"],["食パン","しょくぱん","斤","food","staple"],["パン","ぱん","袋","food","staple"],["うどん","うどん","玉","food","staple"],["そば","そば","束","food","staple"],["そうめん","そうめん","束","food","staple"],["パスタ","ぱすた","袋","food","staple"],["中華麺","ちゅうかめん","玉","food","staple"],["餅","もち","個","food","staple"],["シリアル","しりある","箱","food","staple"],["小麦粉","こむぎこ","袋","food","staple",1],["パン粉","ぱんこ","袋","food","staple",1],["片栗粉","かたくりこ","袋","food","staple",1],["ホットケーキミックス","ほっとけーきみっくす","袋","food","staple"],
  // --- 調味料 🧂（一度登録すれば「常備」扱い） ---
  ["醤油","しょうゆ","本","food","seasoning",1],["みりん","みりん","本","food","seasoning",1],["料理酒","りょうりしゅ","本","food","seasoning",1],["酢","す","本","food","seasoning",1],["砂糖","さとう","袋","food","seasoning",1],["塩","しお","袋","food","seasoning",1],["味噌","みそ","パック","food","seasoning",1],["ケチャップ","けちゃっぷ","本","food","seasoning",1],["マヨネーズ","まよねーず","本","food","seasoning",1],["中濃ソース","ちゅうのうそーす","本","food","seasoning",1],["サラダ油","さらだあぶら","本","food","seasoning",1],["ごま油","ごまあぶら","本","food","seasoning",1],["オリーブオイル","おりーぶおいる","本","food","seasoning",1],["めんつゆ","めんつゆ","本","food","seasoning",1],["ポン酢","ぽんず","本","food","seasoning",1],["焼肉のたれ","やきにくのたれ","本","food","seasoning",1],["カレールー","かれーるー","箱","food","seasoning",1],["コンソメ","こんそめ","箱","food","seasoning",1],["鶏ガラスープの素","とりがらすーぷのもと","袋","food","seasoning",1],["だしの素","だしのもと","袋","food","seasoning",1],["こしょう","こしょう","本","food","seasoning",1],["七味唐辛子","しちみとうがらし","本","food","seasoning",1],["わさび","わさび","本","food","seasoning",1],["からし","からし","本","food","seasoning",1],["はちみつ","はちみつ","本","food","seasoning",1],["ジャム","じゃむ","瓶","food","seasoning",1],
  // --- コーヒー ☕️・飲み物 🥤・その他 🍱 ---
  ["コーヒー","こーひー","本","food","coffee"],["紅茶","こうちゃ","箱","food","drink"],["緑茶（茶葉）","りょくちゃ","袋","food","drink"],["お茶","おちゃ","本","food","drink"],["ビール","びーる","本","food","drink"],["炭酸水","たんさんすい","本","food","drink"],["ジュース","じゅーす","本","food","drink"],["海苔","のり","袋","food","other"],["ふりかけ","ふりかけ","袋","food","other"],["梅干し","うめぼし","パック","food","other"],["キムチ","きむち","パック","food","other"],["漬物","つけもの","パック","food","other"],["冷凍餃子","れいとうぎょうざ","袋","food","other"],["冷凍うどん","れいとううどん","袋","food","other"],["冷凍野菜","れいとうやさい","袋","food","other"],["アイス","あいす","個","food","other"],
  // --- 日用品 🧻 ---
  ["トイレットペーパー","といれっとぺーぱー","ロール","daily","daily"],["キッチンペーパー","きっちんぺーぱー","ロール","daily","daily"],["ティッシュ","てぃっしゅ","箱","daily","daily"],["ウェットティッシュ","うぇっとてぃっしゅ","個","daily","daily"],["シャンプー","しゃんぷー","本","daily","daily"],["トリートメント","とりーとめんと","本","daily","daily"],["ボディソープ","ぼでぃそーぷ","本","daily","daily"],["ハンドソープ","はんどそーぷ","本","daily","daily"],["石鹸","せっけん","個","daily","daily"],["歯磨き粉","はみがきこ","本","daily","daily"],["歯ブラシ","はぶらし","本","daily","daily"],["洗顔料","せんがんりょう","本","daily","daily"],["化粧水","けしょうすい","本","daily","daily"],["ゴミ袋","ごみぶくろ","枚","daily","daily"],["ラップ","らっぷ","本","daily","daily"],["アルミホイル","あるみほいる","本","daily","daily"],["ジップ袋","じっぷぶくろ","枚","daily","daily"],["食器用洗剤","しょっきようせんざい","本","daily","daily"],["スポンジ","すぽんじ","個","daily","daily"],["洗濯洗剤","せんたくせんざい","本","daily","daily"],["柔軟剤","じゅうなんざい","本","daily","daily"],["漂白剤","ひょうはくざい","本","daily","daily"],["お風呂用洗剤","おふろようせんざい","本","daily","daily"],["トイレ用洗剤","といれようせんざい","本","daily","daily"],["掃除シート","そうじしーと","袋","daily","daily"],["除菌スプレー","じょきんすぷれー","本","daily","daily"],["単3電池","たんさんでんち","本","daily","daily"],["単4電池","たんよんでんち","本","daily","daily"],["マスク","ますく","枚","daily","daily"],["絆創膏","ばんそうこう","枚","daily","daily"],["コンタクト洗浄液","こんたくとせんじょうえき","本","daily","daily"],["生理用品","せいりようひん","個","daily","daily"],["おむつ","おむつ","枚","daily","daily"],["ペットフード","ぺっとふーど","袋","daily","daily"],
];
const CAT_LABEL = { food: "食材", daily: "日用品" };
const catIcon = (c) => (c === "daily" ? "🧻" : "🍽");
const GROUP_ICONS = { veg: "🥬", fruit: "🍎", meat: "🥩", fish: "🐟", egg: "🥚", milk: "🥛", dairy: "🧀", soy: "🫘", staple: "🍚", seasoning: "🧂", coffee: "☕️", drink: "🥤", other: "🍱", daily: "🧻" };
const itemIcon = (it) => GROUP_ICONS[it.g] || (it.cat === "daily" ? "🧻" : "🍱");
// 名前からカタログを引いてグループ・常備フラグを推定（旧データの移行用）
const lookupCatalog = (name) => CATALOG.find(([n]) => norm(n) === norm(name) || norm(name).includes(norm(n)) || norm(n).includes(norm(name)));
const migrateItem = (i) => {
  if (i.g) return i;
  const hit = lookupCatalog(i.name);
  const g = hit ? (hit[4] || "other") : (i.cat === "daily" ? "daily" : "other");
  const isPantry = !!(hit && hit[5]);
  if (isPantry && i.kind !== "pantry") return { ...i, g, kind: "pantry", ratePerDay: 0 };
  return { ...i, g };
};
const searchCatalog = (q, existingNames) => {
  const nq = norm(q);
  if (!nq) return [];
  return CATALOG
    .filter(([name, kana]) => norm(name).includes(nq) || kana.includes(nq))
    .filter(([name]) => !existingNames.has(norm(name)))
    .slice(0, 24);
};

const DEFAULT_DATA = {
  setupDone: false,
  items: [],
  extras: [],   // 単発の買い物メモ {id, name}
  lastCheck: "",
  aiEnabled: true, // AI提案。サーバー(/api/suggest)経由で安全に呼び出します
};

// ================= styles =================
const css = `
  :root { --ink:#3A3335; --sub:#9C8F88; --line:#F2E3D5; --bg:#FFF6EC; --card:#FFFFFF;
          --pop:#FF7A59; --pop-dark:#E05A3B; --pop-soft:#FFE9E2;
          --mint:#2FBFA0; --mint-soft:#E0F6EF; --sun:#F5A623; --sun-soft:#FFF1D6;
          --red:#E85D5D; --red-soft:#FDE4E4; }
  .uz { min-height:100vh; background:var(--bg); color:var(--ink);
    font-family:"Hiragino Maru Gothic ProN","Hiragino Kaku Gothic ProN","Yu Gothic","Noto Sans JP",sans-serif; -webkit-font-smoothing:antialiased; }
  .uz-wrap { max-width:480px; margin:0 auto; padding:20px 20px 116px; }
  .uz-brandrow { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
  .uz-logo { width:30px; height:30px; border-radius:10px; background:var(--pop); color:#fff;
    display:flex; align-items:center; justify-content:center; font-weight:800; font-size:18px;
    box-shadow:0 3px 0 var(--pop-dark); transform:rotate(-6deg); }
  .uz-brand { font-size:11px; letter-spacing:.2em; color:var(--sub); font-weight:800; }
  .uz-page-title { font-size:26px; font-weight:800; margin-bottom:4px; letter-spacing:.02em; }
  .uz-page-sub { font-size:12px; color:var(--sub); line-height:1.8; margin-bottom:16px; }
  .uz-group-label { font-size:11px; font-weight:800; letter-spacing:.16em; color:var(--sub); margin:20px 2px 8px; }
  .uz-card { background:var(--card); border:2px solid var(--line); border-radius:20px; overflow:hidden;
    box-shadow:0 4px 0 rgba(58,51,53,.05); }
  .uz-row { display:flex; align-items:center; gap:10px; padding:13px 14px; border-bottom:2px dashed var(--line); }
  .uz-row:last-child { border-bottom:none; }
  .uz-row-main { flex:1; min-width:0; }
  .uz-row-title { font-size:15px; font-weight:700; }
  .uz-row-title.done { text-decoration:line-through; color:#C9BDB6; }
  .uz-row-sub { font-size:11px; color:var(--sub); margin-top:2px; }
  .uz-pill { flex-shrink:0; font-size:11px; font-weight:800; padding:4px 10px; border-radius:999px; white-space:nowrap; }
  .uz-pill.red { background:var(--red-soft); color:var(--red); }
  .uz-pill.amber { background:var(--sun-soft); color:#C57F13; }
  .uz-pill.green { background:var(--mint-soft); color:var(--mint); }
  .uz-buy { flex-shrink:0; border:none; background:var(--pop); color:#fff; border-radius:12px;
    padding:9px 14px; font-size:13px; font-weight:800; cursor:pointer; font-family:inherit;
    box-shadow:0 3px 0 var(--pop-dark); }
  .uz-buy:active { transform:translateY(2px); box-shadow:none; }
  .uz-ghost { flex-shrink:0; border:2px solid var(--line); background:#fff; color:var(--sub);
    border-radius:12px; padding:7px 12px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; }
  .uz-ghost:active { background:var(--pop-soft); }
  .uz-del { flex-shrink:0; border:none; background:none; color:#D8CCC4; font-size:16px; cursor:pointer; padding:4px; font-family:inherit; }
  .uz-empty { padding:28px 16px; font-size:13px; color:var(--sub); text-align:center; line-height:1.9; }
  .uz-empty-big { font-size:38px; margin-bottom:6px; }
  .uz-add { display:flex; gap:8px; margin-top:10px; }
  .uz-input { flex:1; min-width:0; border:2px solid var(--line); border-radius:14px; padding:11px 12px;
    font-size:14px; background:var(--card); color:var(--ink); font-family:inherit; }
  .uz-input:focus { outline:none; border-color:var(--pop); }
  .uz-btn { border:none; background:var(--pop); color:#fff; border-radius:14px; padding:11px 16px;
    font-size:14px; font-weight:800; cursor:pointer; flex-shrink:0; font-family:inherit;
    box-shadow:0 3px 0 var(--pop-dark); }
  .uz-btn:active { transform:translateY(2px); box-shadow:none; }
  .uz-btn.wide { width:100%; padding:15px; margin-top:14px; }
  .uz-btn:disabled { opacity:.5; }
  .uz-step { display:flex; align-items:center; flex-shrink:0; border:2px solid var(--line); border-radius:14px; overflow:hidden; background:#fff; }
  .uz-step button { border:none; background:none; width:36px; height:36px; font-size:18px; color:var(--pop); font-weight:800; cursor:pointer; font-family:inherit; }
  .uz-step button:active { background:var(--pop-soft); }
  .uz-step-val { min-width:56px; text-align:center; font-size:14px; font-weight:800; }
  .uz-step-val small { font-size:10px; color:var(--sub); font-weight:400; }
  .uz-days-input { width:56px; text-align:center; border:2px solid var(--line); border-radius:12px; padding:8px 4px; font-size:14px; font-family:inherit; background:#fff; color:var(--ink); font-weight:700; }
  .uz-tag { display:inline-flex; align-items:center; gap:5px; background:#fff; border:2px solid var(--line); border-radius:999px; padding:7px 13px; font-size:13px; font-weight:700; margin:0 6px 8px 0; cursor:pointer; font-family:inherit; color:var(--ink); }
  .uz-tag:active { background:var(--pop-soft); border-color:var(--pop); }
  .uz-tag .uz-tag-cat { font-size:12px; }
  .uz-ai-btn { display:flex; align-items:center; gap:12px; width:100%; text-align:left; background:var(--pop); border:none; border-radius:18px; padding:16px; margin-bottom:12px; cursor:pointer; font-family:inherit; color:#fff; box-shadow:0 4px 0 var(--pop-dark); }
  .uz-ai-btn:active { transform:translateY(2px); box-shadow:none; }
  .uz-ai-btn:disabled { opacity:.7; }
  .uz-ai-icon { font-size:28px; }
  .uz-ai-title { font-size:15px; font-weight:800; }
  .uz-ai-sub { font-size:11px; opacity:.9; margin-top:2px; }
  .uz-menu-card { background:var(--card); border:2px solid var(--line); border-radius:20px; padding:16px; margin-bottom:10px; box-shadow:0 4px 0 rgba(58,51,53,.05); }
  .uz-menu-name { font-size:17px; font-weight:800; }
  .uz-menu-point { font-size:12px; color:var(--pop); font-weight:700; margin-top:4px; }
  .uz-menu-line { font-size:12px; color:var(--sub); margin-top:8px; line-height:1.9; }
  .uz-ing { display:inline-block; background:var(--mint-soft); color:var(--mint); border-radius:999px; padding:2px 9px; font-size:11px; font-weight:700; margin:2px 3px 0 0; }
  .uz-ing.miss { background:var(--sun-soft); color:#C57F13; }
  .uz-idea { background:var(--pop-soft); border:2px solid #FFD3C6; border-radius:16px; padding:13px 14px; margin-bottom:10px; font-size:13px; line-height:1.8; }
  .uz-idea b { color:var(--pop); }
  .uz-note { font-size:11px; color:var(--sub); line-height:1.7; margin-top:10px; }
  .uz-banner { display:flex; align-items:center; gap:12px; width:100%; text-align:left; background:var(--sun-soft); border:2px solid #F7DCA8; border-radius:18px; padding:14px; margin-bottom:14px; cursor:pointer; font-family:inherit; color:var(--ink); }
  .uz-banner-icon { font-size:26px; }
  .uz-banner-title { font-size:14px; font-weight:800; }
  .uz-banner-sub { font-size:11px; color:var(--sub); margin-top:2px; }
  .uz-tabs { position:fixed; bottom:0; left:0; right:0; background:rgba(255,255,255,.96); backdrop-filter:blur(10px); border-top:2px solid var(--line); display:flex; justify-content:space-around; padding:8px 4px calc(14px + env(safe-area-inset-bottom)); }
  .uz-tab { border:none; background:none; font-family:inherit; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:3px; color:#C4B8B0; font-size:10px; font-weight:800; padding:5px 13px; border-radius:14px; position:relative; }
  .uz-tab.on { color:var(--pop); background:var(--pop-soft); }
  .uz-tab-icon { font-size:22px; line-height:1; }
  .uz-tab-badge { position:absolute; top:-2px; right:2px; min-width:17px; height:17px; border-radius:999px; background:var(--red); color:#fff; font-size:10px; display:flex; align-items:center; justify-content:center; padding:0 4px; border:2px solid #fff; }
  .uz-toast { position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:var(--ink); color:#fff; font-size:13px; font-weight:700; padding:10px 18px; border-radius:999px; z-index:50; max-width:88%; text-align:center; }
  .uz-progress { display:flex; gap:6px; margin:14px 0 20px; }
  .uz-progress span { flex:1; height:6px; border-radius:99px; background:var(--line); }
  .uz-progress span.on { background:var(--pop); }
  .uz-textarea { width:100%; min-height:72px; border:2px solid var(--line); border-radius:14px; padding:10px 12px; font-size:12px; font-family:inherit; background:#fff; color:var(--ink); box-sizing:border-box; }
  .uz-mascot-row { display:flex; align-items:center; gap:10px; margin:6px 0 18px; }
  .uz-bubble { position:relative; flex:1; background:#fff; border:2px solid var(--line); border-radius:16px;
    padding:11px 14px; font-size:13px; font-weight:700; line-height:1.7; box-shadow:0 3px 0 rgba(58,51,53,.05); }
  .uz-bubble::before { content:""; position:absolute; left:-9px; top:50%; transform:translateY(-50%);
    border:8px solid transparent; border-right-color:var(--line); border-left:none; }
  .uz-bubble::after { content:""; position:absolute; left:-6px; top:50%; transform:translateY(-50%);
    border:7px solid transparent; border-right-color:#fff; border-left:none; }
  .uz-steps { margin:10px 0 0; padding-left:20px; font-size:12.5px; line-height:1.95; color:var(--ink); }
  .uz-steps li::marker { color:var(--pop); font-weight:800; }
  .uz-spin { display:inline-block; animation:uzrot 1s linear infinite; }
  @keyframes uzrot { to { transform:rotate(360deg); } }
  @media (prefers-reduced-motion:reduce) { * { transition:none !important; animation:none !important; } }
`;

// ================= AI呼び出し（自前サーバー /api/suggest 経由） =================
// APIキーはサーバー側の環境変数にあり、クライアントには一切露出しません。
async function callSuggestApi(payload) {
  const resp = await fetch("/api/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await resp.json().catch(() => null);
  if (!resp.ok || !j) throw new Error((j && j.error) || `サーバーエラー (${resp.status})`);
  return j;
}

// ================= 内蔵レシピエンジン =================
// 基本調味料は「家にある前提」として在庫を問わない
const ASSUMED = new Set(["醤油", "みりん", "料理酒", "酢", "砂糖", "塩", "こしょう", "サラダ油", "ごま油", "オリーブオイル", "ケチャップ", "マヨネーズ", "めんつゆ", "ポン酢", "コンソメ", "鶏ガラスープの素", "だしの素", "片栗粉", "小麦粉", "パン粉", "味噌"]);
const LOCAL_RECIPES = [
  { name: "肉じゃが", uses: ["じゃがいも", "玉ねぎ", "にんじん", "豚"], point: "根菜をまとめて消費できます", time: "約25分", steps: ["じゃがいも・玉ねぎ・にんじんを一口大に切る", "豚肉→野菜の順に油で炒める", "ひたひたの水と醤油・みりん・砂糖各大2で15分煮る"] },
  { name: "カレーライス", uses: ["じゃがいも", "玉ねぎ", "にんじん", "カレールー"], point: "野菜の在庫整理に最強です", time: "約30分", steps: ["具材を一口大に切って炒める", "水を加えて15分煮る", "火を止めてルーを溶かし、さらに5分煮込む"] },
  { name: "キーマカレー", uses: ["ひき肉", "玉ねぎ", "にんじん", "カレールー"], point: "ひき肉があれば15分", time: "約20分", steps: ["玉ねぎ・にんじんをみじん切りにする", "ひき肉と一緒に炒める", "水少なめ＋ルーで10分煮る"] },
  { name: "クリームシチュー", uses: ["じゃがいも", "にんじん", "玉ねぎ", "牛乳"], point: "牛乳をたっぷり消費", time: "約30分", steps: ["具材を切って炒める", "水で15分煮る", "牛乳とルーを加えて5分煮る"] },
  { name: "親子丼", uses: ["鶏もも", "卵", "玉ねぎ"], point: "15分で完成します", time: "約15分", steps: ["めんつゆ＋水で玉ねぎと鶏を煮る", "溶き卵を回し入れ半熟でとじる", "ご飯にのせる"] },
  { name: "そぼろ丼", uses: ["ひき肉", "卵", "米"], point: "甘辛そぼろと炒り卵で", time: "約15分", steps: ["ひき肉を醤油・砂糖で甘辛に炒る", "別で炒り卵を作る", "ご飯に2色をのせる"] },
  { name: "オムライス", uses: ["卵", "米", "玉ねぎ"], point: "卵を2〜3個使えます", time: "約20分", steps: ["玉ねぎと具をケチャップでご飯と炒める", "薄焼き卵を作る", "ライスを包んでケチャップをかける"] },
  { name: "チャーハン", uses: ["卵", "長ネギ", "米"], point: "半端な具の受け皿に", time: "約10分", steps: ["溶き卵を半熟で炒めて取り出す", "ご飯とネギを強火で炒める", "卵を戻して塩胡椒・醤油ひと回し"] },
  { name: "天津飯", uses: ["卵", "米", "長ネギ"], point: "卵が余った日の丼", time: "約15分", steps: ["ネギ入りの卵焼きをふんわり焼いてご飯にのせる", "醤油・酢・砂糖＋水溶き片栗粉の甘酢あんをかける"] },
  { name: "だし巻き卵", uses: ["卵"], point: "卵が多い日の定番", time: "約10分", steps: ["卵3個＋だし大さじ3を混ぜる", "卵液を数回に分け、巻きながら焼く"] },
  { name: "卵とトマトの中華炒め", uses: ["卵", "トマト"], point: "5分でもう一品", time: "約8分", steps: ["トマトをくし切りにしてさっと炒め取り出す", "ふんわり炒め卵を作る", "トマトを戻し塩胡椒で調える"] },
  { name: "野菜炒め", uses: ["キャベツ", "豚", "ピーマン"], point: "残り野菜なんでも歓迎", time: "約12分", steps: ["豚肉を炒める", "固い野菜→葉物の順に強火で炒める", "塩胡椒＋醤油ひと回し"] },
  { name: "回鍋肉", uses: ["キャベツ", "豚バラ"], point: "キャベツを一気に消費", time: "約12分", steps: ["豚バラを炒めて取り出す", "キャベツを強火で炒める", "肉を戻して味噌・砂糖・醤油のたれを絡める"] },
  { name: "お好み焼き", uses: ["キャベツ", "卵", "豚バラ"], point: "キャベツ半玉が消えます", time: "約20分", steps: ["小麦粉＋水＋卵＋千切りキャベツを混ぜる", "豚バラをのせて両面を焼く", "ソース・マヨで仕上げる"] },
  { name: "焼きそば", uses: ["中華麺", "キャベツ", "豚"], point: "野菜多めで栄養も", time: "約12分", steps: ["肉と野菜を炒める", "麺と水少々を加えてほぐす", "ソースを絡める"] },
  { name: "焼きうどん", uses: ["うどん", "キャベツ", "豚"], point: "冷蔵庫整理の定番", time: "約12分", steps: ["肉と野菜を炒める", "うどんを加えてほぐす", "醤油＋だしの素で味付け"] },
  { name: "豚の生姜焼き", uses: ["豚ロース", "玉ねぎ", "しょうが"], point: "定番の時短おかず", time: "約12分", steps: ["豚と玉ねぎを焼く", "すりおろし生姜＋醤油・みりん・酒を絡める"] },
  { name: "豚キムチ", uses: ["豚バラ", "キムチ"], point: "5分で完成のご飯泥棒", time: "約8分", steps: ["豚バラを炒める", "キムチを加えて炒め合わせる", "仕上げにごま油"] },
  { name: "豚汁", uses: ["豚", "大根", "にんじん"], point: "根菜と味噌の消費に", time: "約25分", steps: ["豚と根菜をごま油で炒める", "だしで柔らかくなるまで煮る", "味噌を溶き入れる"] },
  { name: "鶏の照り焼き", uses: ["鶏もも"], point: "調味料は家のものだけ", time: "約15分", steps: ["鶏ももを皮目から中火で焼く", "裏返して火を通す", "醤油・みりん・砂糖各大1.5を煮絡める"] },
  { name: "唐揚げ", uses: ["鶏もも", "にんにく", "しょうが"], point: "多めに揚げて翌日弁当に", time: "約40分", steps: ["一口大の鶏を醤油・にんにく・生姜に30分漬ける", "片栗粉をまぶす", "170℃の油で4〜5分揚げる"] },
  { name: "棒棒鶏", uses: ["鶏むね", "きゅうり"], point: "きゅうり消費＆さっぱり", time: "約20分", steps: ["鶏むねを茹でて（レンジ可）裂く", "きゅうりを千切りにする", "マヨ＋ごま油＋醤油＋酢のごまだれをかける"] },
  { name: "ハンバーグ", uses: ["合いびき肉", "玉ねぎ", "卵"], point: "こねて焼くだけ", time: "約25分", steps: ["炒め玉ねぎ・卵・パン粉と肉をこねる", "成形して両面を焼く", "フタをして弱火5分蒸し焼き"] },
  { name: "麻婆豆腐", uses: ["豆腐", "ひき肉"], point: "豆腐の期限前に", time: "約15分", steps: ["ひき肉を味噌・醤油・豆板醤で炒める", "水＋鶏ガラと豆腐を加えて煮る", "水溶き片栗粉でとろみをつける"] },
  { name: "麻婆なす", uses: ["なす", "ひき肉"], point: "なすが余っていたら", time: "約15分", steps: ["なすを多めの油で焼いて取り出す", "ひき肉を炒めてたれを作る", "なすを戻して絡める"] },
  { name: "豆腐ハンバーグ", uses: ["豆腐", "ひき肉", "玉ねぎ"], point: "ヘルシーに量増し", time: "約20分", steps: ["水切り豆腐とひき肉・玉ねぎをこねる", "成形して両面を焼く", "ポン酢か照り焼きだれで"] },
  { name: "冷奴", uses: ["豆腐", "長ネギ"], point: "切るだけの一品", time: "約3分", steps: ["豆腐を切る", "刻みネギと醤油（＋生姜）をのせる"] },
  { name: "味噌汁（豆腐と長ネギ）", uses: ["豆腐", "長ネギ"], point: "毎日の一杯に", time: "約10分", steps: ["だしを沸かす", "豆腐とネギを入れる", "火を止めて味噌を溶く"] },
  { name: "ポテトサラダ", uses: ["じゃがいも", "きゅうり", "卵"], point: "作り置きにも便利", time: "約20分", steps: ["じゃがいもを茹でて潰す", "塩もみきゅうり・ゆで卵を混ぜる", "マヨ＋酢少々で和える"] },
  { name: "きゅうりの浅漬け", uses: ["きゅうり"], point: "きゅうりが余ったら即これ", time: "約12分", steps: ["きゅうりを乱切りか薄切りにする", "塩（＋だしの素）で揉んで10分置く"] },
  { name: "トマトときゅうりのサラダ", uses: ["トマト", "きゅうり"], point: "切って和えるだけ", time: "約5分", steps: ["トマトときゅうりを角切りにする", "オリーブオイル＋塩＋酢で和える"] },
  { name: "ほうれん草のおひたし", uses: ["ほうれん草"], point: "茹でて3分", time: "約8分", steps: ["塩ゆでして冷水にとる", "絞って切り、醤油＋だしをかける"] },
  { name: "小松菜と油揚げの煮浸し", uses: ["小松菜", "油揚げ"], point: "青菜の期限前に", time: "約10分", steps: ["小松菜と油揚げを切る", "めんつゆ＋水で5分煮る"] },
  { name: "なすとピーマンの味噌炒め", uses: ["なす", "ピーマン"], point: "夏野菜の消費に", time: "約12分", steps: ["なす・ピーマンを乱切りで炒める", "味噌・みりん・砂糖のたれを絡める"] },
  { name: "かぼちゃの煮物", uses: ["かぼちゃ"], point: "ほくほくの副菜", time: "約20分", steps: ["かぼちゃを一口大に切る", "ひたひたの水＋醤油・みりん・砂糖で10分煮て冷ます"] },
  { name: "鮭のムニエル", uses: ["鮭", "バター"], point: "切身の期限前に", time: "約12分", steps: ["鮭に塩胡椒して小麦粉をまぶす", "バターで両面をこんがり焼く", "レモンや醤油少々で"] },
  { name: "鮭ときのこのホイル焼き", uses: ["鮭", "しめじ", "玉ねぎ"], point: "包んで焼くだけ", time: "約20分", steps: ["ホイルに玉ねぎ・鮭・きのこ・バターをのせて包む", "フライパンで10分蒸し焼き", "ポン酢でいただく"] },
  { name: "サバの味噌煮", uses: ["サバ", "しょうが"], point: "青魚は早めに消費", time: "約20分", steps: ["サバに熱湯をかけて臭みを取る", "水・味噌・砂糖・みりん・生姜で落しぶたをして10分煮る"] },
  { name: "ぶり大根", uses: ["ぶり", "大根"], point: "大根1本の使い道に", time: "約35分", steps: ["大根を下茹でする", "ぶりと醤油・みりん・砂糖・生姜で20分煮る"] },
  { name: "ナポリタン", uses: ["パスタ", "玉ねぎ", "ピーマン", "ソーセージ"], point: "喫茶店の味を家で", time: "約15分", steps: ["具材を炒める", "茹でた麺を加える", "ケチャップ多めで炒め合わせる"] },
  { name: "ペペロンチーノ", uses: ["パスタ", "にんにく"], point: "在庫が少ない日の救世主", time: "約15分", steps: ["オリーブオイルでにんにくを弱火で香り出し", "茹で汁を少し加えて混ぜる", "茹でた麺と塩で和える"] },
  { name: "カルボナーラ", uses: ["パスタ", "卵", "ベーコン", "チーズ"], point: "卵と乳製品の消費に", time: "約15分", steps: ["ベーコンを炒める", "卵＋チーズ＋黒胡椒を混ぜておく", "火を止めて茹でた麺と手早く和える"] },
  { name: "グラタン", uses: ["牛乳", "チーズ", "玉ねぎ", "じゃがいも"], point: "乳製品をまとめて", time: "約30分", steps: ["具を炒めて小麦粉をふる", "牛乳を加えてとろみをつける", "チーズをのせてオーブンで焼き色をつける"] },
  { name: "きのこの炊き込みご飯", uses: ["米", "しめじ", "油揚げ"], point: "きのこの期限前に", time: "約60分", steps: ["米に醤油・みりん・だしを加える", "きのこと油揚げをのせて炊飯する"] },
  { name: "野菜スープ", uses: ["キャベツ", "にんじん", "玉ねぎ"], point: "残り野菜を全部投入", time: "約15分", steps: ["野菜を小さめに切る", "水＋コンソメで10分煮て塩胡椒"] },
  { name: "ミネストローネ", uses: ["トマト", "玉ねぎ", "にんじん"], point: "トマトの消費に", time: "約20分", steps: ["野菜を角切りにして炒める", "トマトを潰しながら水と煮る", "コンソメ・塩胡椒で調える"] },
  { name: "フレンチトースト", uses: ["食パン", "卵", "牛乳"], point: "朝食が少し豪華に", time: "約15分", steps: ["卵＋牛乳＋砂糖にパンを浸す", "バターで両面を弱火で焼く"] },
  { name: "ピザトースト", uses: ["食パン", "チーズ"], point: "5分で満足の一枚", time: "約8分", steps: ["パンにケチャップを塗り具とチーズをのせる", "トースターで4〜5分焼く"] },
  { name: "バナナヨーグルト", uses: ["バナナ", "ヨーグルト"], point: "朝食やおやつに", time: "約3分", steps: ["バナナを切ってヨーグルトと和える", "お好みではちみつをかける"] },
  { name: "バナナジュース", uses: ["バナナ", "牛乳"], point: "完熟バナナの救済に", time: "約5分", steps: ["バナナと牛乳をミキサーにかける", "お好みではちみつを足す"] },
];
const localMenuSuggest = (invItems) => {
  const names = invItems.map(i => ({ n: i.name, dz: i.dz }));
  const has = (u) => names.find(x => x.n.includes(u) || u.includes(x.n));
  return LOCAL_RECIPES
    .map(rc => {
      const real = rc.uses.filter(u => !ASSUMED.has(u));
      const hits = real.map(u => ({ u, hit: has(u) })).filter(x => x.hit);
      const missing = real.filter(u => !has(u));
      const urgency = hits.length ? Math.min(...hits.map(x => x.hit.dz)) : 99;
      return { name: rc.name, point: rc.point, time: rc.time, steps: rc.steps, uses: hits.map(x => x.hit.n), missing, score: hits.length * 2 - missing.length, urgency };
    })
    .filter(r => r.uses.length >= 1 && r.missing.length <= 1)
    .sort((a, b) => (b.score - a.score) || (a.urgency - b.urgency))
    .slice(0, 5);
};


// ================= ザイコくん（マスコット・しっかり者） =================
function ZaikoKun({ size = 72, mood = "happy" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="ザイコくん" style={{ flexShrink: 0 }}>
      {/* 影 */}
      <ellipse cx="50" cy="91" rx="28" ry="5" fill="rgba(58,51,53,0.10)" />
      {/* きちんと閉じたフタ（しっかり者はフタも閉める） */}
      <rect x="16" y="24" width="68" height="12" rx="4" fill="#EFC489" stroke="#B07E43" strokeWidth="3" />
      <line x1="50" y1="24" x2="50" y2="36" stroke="#B07E43" strokeWidth="2.5" />
      {/* 体（箱） */}
      <rect x="20" y="34" width="60" height="50" rx="8" fill="#E4AC6B" stroke="#B07E43" strokeWidth="3" />
      {/* コーラルのベルト */}
      <rect x="20" y="68" width="60" height="8" fill="#FF7A59" />
      <rect x="20" y="34" width="60" height="50" rx="8" fill="none" stroke="#B07E43" strokeWidth="3" />
      {/* 丸メガネ */}
      <circle cx="38" cy="51" r="8.5" fill="rgba(255,255,255,0.55)" stroke="#3A3335" strokeWidth="2.6" />
      <circle cx="62" cy="51" r="8.5" fill="rgba(255,255,255,0.55)" stroke="#3A3335" strokeWidth="2.6" />
      <line x1="46.5" y1="51" x2="53.5" y2="51" stroke="#3A3335" strokeWidth="2.6" />
      <line x1="29.5" y1="49" x2="21" y2="46" stroke="#3A3335" strokeWidth="2.4" />
      <line x1="70.5" y1="49" x2="79" y2="46" stroke="#3A3335" strokeWidth="2.4" />
      {/* 目 */}
      {mood === "alert" ? (
        <>
          <line x1="34" y1="47" x2="42" y2="50" stroke="#3A3335" strokeWidth="3" strokeLinecap="round" />
          <line x1="66" y1="47" x2="58" y2="50" stroke="#3A3335" strokeWidth="3" strokeLinecap="round" />
          <circle cx="38" cy="53" r="3.4" fill="#3A3335" />
          <circle cx="62" cy="53" r="3.4" fill="#3A3335" />
          <path d="M78 30 q4 5 0 8 q-4 -3 0 -8" fill="#8FD3EF" />
        </>
      ) : (
        <>
          <circle cx="38" cy="51" r="3.8" fill="#3A3335" />
          <circle cx="62" cy="51" r="3.8" fill="#3A3335" />
          <circle cx="39.4" cy="49.6" r="1.2" fill="#fff" />
          <circle cx="63.4" cy="49.6" r="1.2" fill="#fff" />
        </>
      )}
      {/* ほっぺ */}
      <circle cx="28.5" cy="59" r="3.8" fill="#FFB3A0" opacity="0.85" />
      <circle cx="71.5" cy="59" r="3.8" fill="#FFB3A0" opacity="0.85" />
      {/* 口 */}
      {mood === "alert" ? (
        <circle cx="50" cy="62" r="3" fill="none" stroke="#3A3335" strokeWidth="2.8" />
      ) : (
        <path d="M44.5 60.5 Q50 65.5 55.5 60.5" fill="none" stroke="#3A3335" strokeWidth="3" strokeLinecap="round" />
      )}
      {/* チェックボード（在庫リスト） */}
      <g transform="rotate(8 76 74)">
        <rect x="66" y="60" width="22" height="28" rx="3" fill="#FFFDF8" stroke="#B07E43" strokeWidth="2.6" />
        <rect x="72.5" y="56.5" width="9" height="6" rx="2" fill="#2FBFA0" />
        <path d="M70 69 l2.4 2.4 4 -4.4" fill="none" stroke="#2FBFA0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="79" y1="69.5" x2="84.5" y2="69.5" stroke="#D8CCC4" strokeWidth="2" strokeLinecap="round" />
        <path d="M70 77 l2.4 2.4 4 -4.4" fill="none" stroke="#2FBFA0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="79" y1="77.5" x2="84.5" y2="77.5" stroke="#D8CCC4" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* えんぴつ（耳の上） */}
      <g transform="rotate(-24 24 30)">
        <rect x="18" y="27" width="13" height="4" rx="1.4" fill="#F5A623" stroke="#B07E43" strokeWidth="1.6" />
        <polygon points="31,26.6 35.5,29 31,31.4" fill="#FFE3B3" stroke="#B07E43" strokeWidth="1.4" />
      </g>
    </svg>
  );
}

// ================= 検索して品目を選ぶ共通UI =================
function ItemSearch({ existingNames, onPick }) {
  const [q, setQ] = useState("");
  const hits = searchCatalog(q, existingNames);
  const showCustom = q.trim().length > 0 && !hits.some(([name]) => norm(name) === norm(q)) && !existingNames.has(norm(q));
  return (
    <div>
      <div className="uz-add" style={{ marginTop: 0 }}>
        <input className="uz-input" placeholder="食材・日用品を検索（例：ズッキーニ）" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div style={{ marginTop: 10, minHeight: 8 }}>
        {hits.map(([name, kana, unit, cat, g, pantry]) => (
          <button className="uz-tag" key={name} onClick={() => { onPick({ name, unit, cat, g: g || "other", pantry: !!pantry }); setQ(""); }}>
            <span className="uz-tag-cat">{GROUP_ICONS[g] || catIcon(cat)}</span>{name}<span style={{ color: "#B0B2BF", fontSize: 11 }}>＋</span>
          </button>
        ))}
        {showCustom && (
          <button className="uz-tag" style={{ borderStyle: "dashed" }} onClick={() => { onPick({ name: q.trim(), unit: "個", cat: "food", g: "other", custom: true }); setQ(""); }}>
            ✏️ 「{q.trim()}」を新しく登録
          </button>
        )}
        {q && hits.length === 0 && !showCustom && <div className="uz-note">すでに登録済みです</div>}
      </div>
    </div>
  );
}

// ================= 初回セットアップ（必須） =================
function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(1); // 1:登録 2:消費日数
  const [pending, setPending] = useState([]); // {name, unit, cat, qty, days}
  const existingNames = new Set(pending.map(p => norm(p.name)));

  const pick = (e) => setPending(ps => [...ps, { ...e, qty: 1, days: e.pantry ? null : (e.cat === "daily" ? 30 : 7) }]);
  const setQty = (i, d) => setPending(ps => ps.map((p, idx) => idx === i ? { ...p, qty: Math.max(stepOf(p.unit), r1(p.qty + d)) } : p));
  const setDays = (i, v) => setPending(ps => ps.map((p, idx) => idx === i ? { ...p, days: v } : p));
  const remove = (i) => setPending(ps => ps.filter((_, idx) => idx !== i));

  const finish = () => {
    const t = todayStr();
    const items = pending.map(p => {
      if (p.pantry) {
        return { id: uid(), name: p.name, unit: p.unit, cat: p.cat, g: p.g || "other",
          stock: p.qty, stockDate: t, purchasedSince: 0, ratePerDay: 0,
          buyQty: 1, kind: "pantry", snoozeUntil: "" };
      }
      const days = Math.max(1, parseFloat(p.days) || 7);
      return {
        id: uid(), name: p.name, unit: p.unit, cat: p.cat, g: p.g || "other",
        stock: p.qty, stockDate: t, purchasedSince: 0,
        ratePerDay: r1(Math.max(0.01, p.qty / days)),
        buyQty: 1, kind: "regular", snoozeUntil: "",
      };
    });
    onComplete(items);
  };

  return (
    <div className="uz-wrap" style={{ paddingBottom: 40 }}>
      <div className="uz-brandrow"><span className="uz-logo">Z</span><span className="uz-brand">UCHI-NO-ZAIKO</span></div>
      <div className="uz-page-title">{step === 1 ? "① いま家にあるものを登録" : "② どのくらいで使い切る？"}</div>
      <div className="uz-mascot-row">
        <ZaikoKun size={70} />
        <div className="uz-bubble">{step === 1 ? "はじめまして、ザイコだよ！家にあるものを教えてね📦" : "それぞれ何日くらいでなくなるか教えて！あとはボクにまかせて〜"}</div>
      </div>
      <div className="uz-progress"><span className="on" /><span className={step === 2 ? "on" : ""} /></div>

      {step === 1 && (<>
        <div className="uz-page-sub">検索して、家にある食材・日用品を追加してください。数はだいたいでOK。カタログにない物は名前を入力すればそのまま登録できます。</div>
        <ItemSearch existingNames={existingNames} onPick={pick} />
        {pending.length > 0 && (<>
          <div className="uz-group-label">登録するもの（{pending.length}件）</div>
          <div className="uz-card">
            {pending.map((p, i) => (
              <div className="uz-row" key={p.name}>
                <div className="uz-row-main"><div className="uz-row-title">{itemIcon(p)} {p.name}</div></div>
                <div className="uz-step">
                  <button onClick={() => setQty(i, -stepOf(p.unit))}>−</button>
                  <div className="uz-step-val">{p.qty}<small>{p.unit}</small></div>
                  <button onClick={() => setQty(i, +stepOf(p.unit))}>＋</button>
                </div>
                <button className="uz-del" onClick={() => remove(i)}>×</button>
              </div>
            ))}
          </div>
        </>)}
        <button className="uz-btn wide" disabled={pending.length === 0} onClick={() => setStep(2)}>
          次へ（消費ペースを入力）
        </button>
        {pending.length === 0 && <div className="uz-note">最低1つ登録すると次へ進めます。あとからいつでも追加できます。</div>}
      </>)}

      {step === 2 && (<>
        <div className="uz-page-sub">それぞれ「今の量をだいたい何日で使い切るか」を入れてください。ここだけは手動ですが、以降はこの数字をもとに在庫が自動で管理され、実績から自動で補正されていきます。</div>
        <div className="uz-card">
          {pending.map((p, i) => (
            <div className="uz-row" key={p.name}>
              <div className="uz-row-main">
                <div className="uz-row-title">{itemIcon(p)} {p.name}</div>
                <div className="uz-row-sub">{p.pantry ? "調味料などの常備品" : `${p.qty}${p.unit} を…`}</div>
              </div>
              {p.pantry ? (
                <span className="uz-pill green">ずっとある扱い</span>
              ) : (<>
                <input className="uz-days-input" type="number" min="1" value={p.days} onChange={e => setDays(i, e.target.value)} />
                <span style={{ fontSize: 12, color: "#8A8D9C", flexShrink: 0 }}>日で使い切る</span>
              </>)}
            </div>
          ))}
        </div>
        <button className="uz-btn wide" onClick={finish}>はじめる</button>
        <button className="uz-ghost" style={{ width: "100%", marginTop: 8, padding: 12 }} onClick={() => setStep(1)}>← 登録に戻る</button>
      </>)}
    </div>
  );
}

// ================= main =================
export default function UchiNoZaiko() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("stock"); // stock | shop | menu | settings | check
  const [toast, setToast] = useState("");
  const [menus, setMenus] = useState(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuSource, setMenuSource] = useState(""); // "ai" | "local"
  const [ideas, setIdeas] = useState(null);
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [checkDraft, setCheckDraft] = useState(null);
  const [shopQty, setShopQty] = useState({});   // 提案数量の手直し {id: qty}
  const [addOpen, setAddOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState(null); // 在庫タブでの追加途中 {name,unit,cat,qty,days}
  const [quick, setQuick] = useState("");
  const [extraInput, setExtraInput] = useState("");
  const [importText, setImportText] = useState("");
  const today = todayStr();

  // ---- load / save（ブラウザのlocalStorageに永続化） ----
  useEffect(() => {
    // iOSにストレージの永続化を依頼（自動削除されにくくなる）
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    let loaded = DEFAULT_DATA;
    try {
      const raw = window.localStorage.getItem("uchi-zaiko-v2");
      if (raw) loaded = { ...DEFAULT_DATA, ...JSON.parse(raw) };
    } catch (e) { /* 初回 */ }
    loaded = { ...loaded, items: (loaded.items || []).map(migrateItem) };
    setData(loaded);
  }, []);
  const persist = useCallback(async (next) => {
    setData(next);
    try { window.localStorage.setItem("uchi-zaiko-v2", JSON.stringify(next)); }
    catch (e) { console.error("保存失敗", e); }
  }, []);
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  useEffect(() => {
    if (tab === "check" && data && !checkDraft) {
      const d = {};
      data.items.forEach(i => { d[i.id] = fmtQ(estStock(i), i.unit); });
      setCheckDraft(d);
    }
  }, [tab, data]);

  if (!data) return (<div className="uz"><style>{css}</style><div className="uz-wrap"><div className="uz-empty" style={{ paddingTop: 100 }}>読み込み中…</div></div></div>);

  // ---- ① 初回は登録必須 ----
  if (!data.setupDone) {
    return (
      <div className="uz">
        <style>{css}</style>
        <SetupWizard onComplete={(items) => { persist({ ...data, items, setupDone: true, lastCheck: today }); showToast("セットアップ完了！ここから自動管理が始まります"); }} />
        {toast && <div className="uz-toast">{toast}</div>}
      </div>
    );
  }

  // ---- derived ----
  const items = data.items.map(it => ({ ...it, est: estStock(it), dz: daysToZero(it) }));
  const snoozed = (it) => it.snoozeUntil && it.snoozeUntil > today;
  // ④ 買い物提案：定番かつ2日以内に切れる予測（見送り中は除く）
  const needs = items.filter(i => i.kind !== "oneoff" && i.kind !== "pantry" && i.dz <= 2 && !snoozed(i)).sort((a, b) => a.dz - b.dz);
  const snoozedList = items.filter(i => i.kind !== "oneoff" && i.kind !== "pantry" && i.dz <= 2 && snoozed(i));
  const shopCount = needs.length + data.extras.length;
  const sinceCheck = data.lastCheck ? daysSince(data.lastCheck) : 99;
  const checkDue = sinceCheck >= 7;
  // おすすめ購入量：1週間分をカバーする量（0.5刻み切り上げ、最低は普段の購入単位）
  const suggestQty = (it) => {
    const st = stepOf(it.unit);
    const deficit = it.ratePerDay * 7 - it.est;
    const q = Math.ceil(Math.max(deficit, it.buyQty || 1) / st) * st;
    return Math.max(st, r1(q));
  };

  // ---- actions ----
  const markBought = (it, qty) => {
    const q = qty !== undefined ? qty : suggestQty(it);
    persist({ ...data, items: data.items.map(x => x.id === it.id ? { ...x, purchasedSince: (x.purchasedSince || 0) + q, snoozeUntil: "" } : x) });
    showToast(`${it.name} +${q}${it.unit} を在庫に反映`);
  };
  const snooze = (it) => {
    persist({ ...data, items: data.items.map(x => x.id === it.id ? { ...x, snoozeUntil: addDays(today, 3) } : x) });
    showToast(`${it.name} は今回見送り（3日後に再提案）`);
  };
  const unsnooze = (it) => persist({ ...data, items: data.items.map(x => x.id === it.id ? { ...x, snoozeUntil: "" } : x) });
  const buyExtra = (id) => persist({ ...data, extras: data.extras.filter(e => e.id !== id) });
  const addExtra = () => {
    const n = extraInput.trim(); if (!n) return;
    if (!data.extras.some(e => norm(e.name) === norm(n))) persist({ ...data, extras: [...data.extras, { id: uid(), name: n }] });
    setExtraInput("");
  };
  const buyAll = () => {
    if (needs.length === 0 && data.extras.length === 0) return;
    persist({
      ...data,
      items: data.items.map(x => {
        const it = needs.find(n => n.id === x.id);
        if (!it) return x;
        const q = shopQty[x.id] !== undefined ? shopQty[x.id] : suggestQty(it);
        return { ...x, purchasedSince: (x.purchasedSince || 0) + q, snoozeUntil: "" };
      }),
      extras: [],
    });
    setShopQty({});
    showToast("リストの分をすべて在庫に反映しました");
  };
  // テキストで一気に記録
  const quickLog = () => {
    const raw = quick.trim(); if (!raw) return;
    const tokens = raw.split(/[、,\s/／]+/).map(t => t.trim()).filter(Boolean);
    let next = { ...data }; const applied = []; const created = [];
    for (const tk of tokens) {
      const m = tk.match(/^(.*?)[\s×x]*([0-9]+(?:\.[0-9]+)?)?$/);
      const name = (m && m[1] ? m[1] : tk).trim();
      const qty = m && m[2] ? Math.max(0.5, parseFloat(m[2])) : null;
      if (!name) continue;
      const it = next.items.find(s => norm(s.name) === norm(name) || norm(name).includes(norm(s.name)) || norm(s.name).includes(norm(name)));
      if (it) {
        const q = qty !== null ? qty : suggestQty({ ...it, est: estStock(it) });
        next = { ...next, items: next.items.map(x => x.id === it.id ? { ...x, purchasedSince: (x.purchasedSince || 0) + q, snoozeUntil: "" } : x) };
        applied.push(`${it.name}+${q}`);
      } else {
        const hit = CATALOG.find(([n]) => norm(n) === norm(name));
        const isPantry = !!(hit && hit[5]);
        next = { ...next, items: [...next.items, { id: uid(), name, unit: hit ? hit[2] : "個", cat: hit ? hit[3] : "food", g: hit ? (hit[4] || "other") : "other", stock: qty !== null ? qty : 1, stockDate: today, purchasedSince: 0, ratePerDay: isPantry ? 0 : 0.3, buyQty: 1, kind: isPantry ? "pantry" : "oneoff", snoozeUntil: "" }] };
        created.push(name);
      }
      next = { ...next, extras: next.extras.filter(ex => !(norm(ex.name) === norm(name) || norm(name).includes(norm(ex.name)))) };
    }
    persist(next); setQuick("");
    showToast([applied.length ? `反映：${applied.join("、")}` : "", created.length ? `新規：${created.join("、")}` : ""].filter(Boolean).join(" / ") || "記録しました");
  };

  // 棚卸し
  const stepDraft = (id, d) => setCheckDraft(dr => ({ ...dr, [id]: Math.max(0, r1((dr[id] || 0) + d)) }));
  const saveCheck = () => {
    const nextItems = data.items.map(it => {
      if (it.kind === "pantry") return it; // 常備品は棚卸し対象外
      const actual = checkDraft && checkDraft[it.id] !== undefined ? checkDraft[it.id] : estStock(it);
      const d = Math.max(1, daysSince(it.stockDate) || 1);
      const consumed = it.stock + (it.purchasedSince || 0) - actual;
      let rate = it.ratePerDay;
      if (consumed >= 0) {
        const measured = consumed / d;
        rate = r1(Math.max(0.01, it.ratePerDay * 0.5 + measured * 0.5));
      }
      return { ...it, stock: actual, stockDate: today, purchasedSince: 0, ratePerDay: rate };
    }).filter(it => !(it.kind === "oneoff" && it.stock <= 0));
    persist({ ...data, items: nextItems, lastCheck: today });
    setCheckDraft(null); setTab("stock");
    showToast("棚卸し完了。消費ペースを更新しました");
  };

  // 在庫タブでの品目追加（②の入力込み）
  const beginAdd = (e) => setPendingAdd({ ...e, qty: 1, days: e.pantry ? null : (e.cat === "daily" ? 30 : 7) });
  const commitAdd = () => {
    if (!pendingAdd) return;
    const days = Math.max(1, parseFloat(pendingAdd.days) || 7);
    persist({
      ...data,
      items: [...data.items, {
        id: uid(), name: pendingAdd.name, unit: pendingAdd.unit, cat: pendingAdd.cat, g: pendingAdd.g || "other",
        stock: pendingAdd.qty, stockDate: today, purchasedSince: 0,
        ratePerDay: pendingAdd.pantry ? 0 : r1(Math.max(0.01, pendingAdd.qty / days)),
        buyQty: 1, kind: pendingAdd.pantry ? "pantry" : "regular", snoozeUntil: "",
      }],
    });
    showToast(`${pendingAdd.name} を追加しました`);
    setPendingAdd(null); setAddOpen(false);
  };
  const delItem = (id) => persist({ ...data, items: data.items.filter(i => i.id !== id) });

  // AI
  const inventoryText = () => items.filter(i => i.est > 0 && i.cat !== "daily").map(i => i.kind === "pantry" ? `${i.name}（常備）` : `${i.name} ${fmtQ(i.est, i.unit)}${i.unit}（あと約${i.dz}日で消費予定）`).join("、");
  const suggestMenus = async () => {
    setMenuLoading(true); setMenus(null); setMenuSource("");
    const inv = items.filter(i => i.est > 0 && i.cat !== "daily");
    if (!data.aiEnabled) {
      setMenus(localMenuSuggest(inv)); setMenuSource("local"); setMenuLoading(false);
      return;
    }
    try {
      const r = await callSuggestApi({ type: "menus", inventory: inventoryText() });
      const ms = Array.isArray(r.menus) ? r.menus : [];
      if (ms.length === 0) throw new Error("提案が空でした");
      setMenus(ms); setMenuSource("ai");
    } catch (e) {
      console.error("AI献立失敗:", e);
      const local = localMenuSuggest(inv);
      setMenus(local); setMenuSource("local");
      if (local.length === 0) showToast(`提案に失敗：${e.message || "通信エラー"}`);
    }
    setMenuLoading(false);
  };
  const suggestIdeas = async () => {
    setIdeaLoading(true); setIdeas(null);
    const inv = items.filter(i => i.est > 0 && i.cat !== "daily");
    const localIdeas = () => localMenuSuggest(inv).filter(r => r.missing.length >= 1).slice(0, 3)
      .map(r => ({ buy: r.missing, dish: r.name, withHome: r.uses }));
    if (!data.aiEnabled) { setIdeas(localIdeas()); setIdeaLoading(false); return; }
    try {
      const listText = needs.map(i => i.name).concat(data.extras.map(e => e.name)).join("、") || "（リストは空）";
      const r = await callSuggestApi({ type: "ideas", inventory: inventoryText(), list: listText });
      const arr = Array.isArray(r.ideas) ? r.ideas : [];
      if (arr.length === 0) throw new Error("提案が空でした");
      setIdeas(arr);
    } catch (e) {
      console.error("AI買い足し失敗:", e);
      const local = localIdeas();
      setIdeas(local);
      if (local.length === 0) showToast(`提案に失敗：${e.message || "通信エラー"}`);
    }
    setIdeaLoading(false);
  };
  const missingToList = (arr) => {
    const add = (arr || []).filter(m => !data.extras.some(e => norm(e.name) === norm(m))).map(m => ({ id: uid(), name: m }));
    if (add.length) { persist({ ...data, extras: [...data.extras, ...add] }); showToast("買い物リストに追加しました"); }
  };

  const existingNames = new Set(data.items.map(i => norm(i.name)));
  const stockPill = (i) => i.kind === "pantry" ? ["green", "常備"] : i.est <= 0.01 ? ["red", "切れている頃"] : i.dz <= 2 ? ["amber", `あと約${i.dz}日`] : ["green", `あと約${i.dz}日`];

  // ================= pages =================
  // ザイコくんのひとこと（状況に応じて変化）
  const outNames = items.filter(i => i.kind !== "oneoff" && i.est <= 0.01).map(i => i.name);
  const soonNames = items.filter(i => i.kind !== "oneoff" && i.est > 0.01 && i.dz <= 2).map(i => i.name);
  let mascotMood = "happy";
  let mascotLine = "在庫バッチリだよ〜！今日もいい一日を📦";
  if (checkDue) { mascotMood = "alert"; mascotLine = `そろそろ棚卸しの時期だよ！前回から${sinceCheck}日たってるみたい`; }
  else if (outNames.length > 0) { mascotMood = "alert"; mascotLine = `たいへん！${outNames.slice(0, 2).join("と")}が切れてるかも…買い物タブを見て！`; }
  else if (soonNames.length > 0) { mascotLine = `${soonNames.slice(0, 2).join("と")}がそろそろなくなりそうだよ〜`; }
  else if (data.extras.length > 0) { mascotLine = `買い物メモが${data.extras.length}件あるよ！忘れないでね`; }

  const StockPage = (
    <>
      <div className="uz-brandrow"><span className="uz-logo">Z</span><span className="uz-brand">UCHI-NO-ZAIKO</span></div>
      <div className="uz-page-title">在庫</div>
      <div className="uz-mascot-row">
        <ZaikoKun size={74} mood={mascotMood} />
        <div className="uz-bubble">{mascotLine}</div>
      </div>
      <div className="uz-page-sub">消費ペースから現在の残量を推定しています。買い物と週1回の棚卸しだけで、あとは自動です。</div>

      {checkDue && (
        <button className="uz-banner" onClick={() => setTab("check")}>
          <span className="uz-banner-icon">🗒</span>
          <span>
            <div className="uz-banner-title">今週の棚卸しをしましょう（約3分）</div>
            <div className="uz-banner-sub">前回から{sinceCheck}日。ここで直すほど予測が正確になります</div>
          </span>
        </button>
      )}

      {["food", "daily"].map(cat => {
        const group = items.filter(i => i.cat === cat);
        if (group.length === 0) return null;
        return (
          <div key={cat}>
            <div className="uz-group-label">{catIcon(cat)} {CAT_LABEL[cat]}（{group.length}）</div>
            <div className="uz-card">
              {group.sort((a, b) => a.dz - b.dz).map(i => {
                const [cls, label] = stockPill(i);
                return (
                  <div className="uz-row" key={i.id}>
                    <div className="uz-row-main">
                      <div className="uz-row-title">{itemIcon(i)} {i.name}</div>
                      <div className="uz-row-sub">{i.kind === "pantry" ? "なくなったら買い物メモへどうぞ" : `残り約 ${fmtQ(i.est, i.unit)}${i.unit}・${r1(i.ratePerDay)}${i.unit}/日ペース${i.kind === "oneoff" ? "・都度" : ""}`}</div>
                    </div>
                    <span className={`uz-pill ${cls}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 16 }}>
        {!addOpen ? (
          <button className="uz-ghost" style={{ width: "100%", padding: 13 }} onClick={() => setAddOpen(true)}>＋ 品目を追加（検索）</button>
        ) : (
          <div className="uz-card" style={{ padding: 14 }}>
            {!pendingAdd ? (<>
              <ItemSearch existingNames={existingNames} onPick={beginAdd} />
              <button className="uz-ghost" style={{ width: "100%", marginTop: 6 }} onClick={() => setAddOpen(false)}>閉じる</button>
            </>) : (<>
              <div className="uz-row" style={{ padding: "6px 0" }}>
                <div className="uz-row-main"><div className="uz-row-title">{itemIcon(pendingAdd)} {pendingAdd.name}</div><div className="uz-row-sub">いまある数</div></div>
                <div className="uz-step">
                  <button onClick={() => setPendingAdd(p => ({ ...p, qty: Math.max(stepOf(p.unit), r1(p.qty - stepOf(p.unit))) }))}>−</button>
                  <div className="uz-step-val">{pendingAdd.qty}<small>{pendingAdd.unit}</small></div>
                  <button onClick={() => setPendingAdd(p => ({ ...p, qty: r1(p.qty + stepOf(p.unit)) }))}>＋</button>
                </div>
              </div>
              {pendingAdd.pantry ? (
                <div className="uz-note">調味料などの常備品です。「ずっとある」扱いになります。</div>
              ) : (
                <div className="uz-row" style={{ padding: "6px 0" }}>
                  <div className="uz-row-main"><div className="uz-row-sub">この量を何日で使い切る？</div></div>
                  <input className="uz-days-input" type="number" min="1" value={pendingAdd.days} onChange={e => setPendingAdd(p => ({ ...p, days: e.target.value }))} />
                  <span style={{ fontSize: 12, color: "#8A8C9C" }}>日</span>
                </div>
              )}
              <div className="uz-add">
                <button className="uz-ghost" style={{ flex: 1 }} onClick={() => setPendingAdd(null)}>← 戻る</button>
                <button className="uz-btn" style={{ flex: 2 }} onClick={commitAdd}>この内容で追加</button>
              </div>
            </>)}
          </div>
        )}
      </div>

      <button className="uz-ghost" style={{ width: "100%", padding: 13, marginTop: 10 }} onClick={() => setTab("check")}>🗒 在庫を数え直す（棚卸し）</button>
    </>
  );

  const ShopPage = (
    <>
      <div className="uz-brandrow"><span className="uz-logo">Z</span><span className="uz-brand">UCHI-NO-ZAIKO</span></div>
      <div className="uz-page-title">買い物</div>
      <div className="uz-mascot-row">
        <ZaikoKun size={66} mood={needs.length > 0 ? "alert" : "happy"} />
        <div className="uz-bubble">{needs.length > 0 ? `メモの分もあわせて${shopCount}点だよ。ボクのおすすめの量も書いておいたからね！` : "いまは買うものナシ！えらいえらい"}</div>
      </div>
      <div className="uz-page-sub">切れそうなものと、1週間もたせるための購入量を提案します。数は直せますし、見送りもできます。</div>

      {needs.length > 0 && (<>
        <div className="uz-group-label">おすすめの買い物（{needs.length}件）</div>
        <div className="uz-card">
          {needs.map(it => {
            const sq = shopQty[it.id] !== undefined ? shopQty[it.id] : suggestQty(it);
            return (
              <div className="uz-row" key={it.id}>
                <div className="uz-row-main">
                  <div className="uz-row-title">{itemIcon(it)} {it.name}</div>
                  <div className="uz-row-sub">残り約{fmtQ(it.est, it.unit)}{it.unit} → <b style={{ color: "#FF7A59" }}>{sq}{it.unit}</b> 買うと約1週間もちます</div>
                </div>
                <div className="uz-step">
                  <button onClick={() => setShopQty(s => ({ ...s, [it.id]: Math.max(stepOf(it.unit), r1(sq - stepOf(it.unit))) }))}>−</button>
                  <div className="uz-step-val">{sq}<small>{it.unit}</small></div>
                  <button onClick={() => setShopQty(s => ({ ...s, [it.id]: r1(sq + stepOf(it.unit)) }))}>＋</button>
                </div>
                <button className="uz-buy" onClick={() => markBought(it, sq)}>買った</button>
                <button className="uz-del" title="今回は見送る" onClick={() => snooze(it)}>⏸</button>
              </div>
            );
          })}
        </div>
        <button className="uz-btn wide" onClick={buyAll}>✓ この内容でぜんぶ買った</button>
      </>)}

      {data.extras.length > 0 && (<>
        <div className="uz-group-label">メモ（今回だけ）</div>
        <div className="uz-card">
          {data.extras.map(ex => (
            <div className="uz-row" key={ex.id}>
              <div className="uz-row-main"><div className="uz-row-title">{ex.name}</div></div>
              <button className="uz-buy" onClick={() => buyExtra(ex.id)}>買った</button>
              <button className="uz-del" onClick={() => buyExtra(ex.id)}>×</button>
            </div>
          ))}
        </div>
      </>)}
      <div className="uz-add">
        <input className="uz-input" placeholder="今回だけ買うものをメモ" value={extraInput} onChange={e => setExtraInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addExtra()} />
        <button className="uz-btn" onClick={addExtra}>追加</button>
      </div>

      {shopCount === 0 && <div className="uz-card" style={{ marginTop: 14 }}><div className="uz-empty"><div className="uz-empty-big">🧺</div>切れそうになったら、自動でここに並びます。</div></div>}

      <div className="uz-group-label">買ったものをサッと記録</div>
      <div className="uz-add" style={{ marginTop: 0 }}>
        <input className="uz-input" placeholder="例：牛乳、卵10、豚こま" value={quick} onChange={e => setQuick(e.target.value)} onKeyDown={e => e.key === "Enter" && quickLog()} />
        <button className="uz-btn" onClick={quickLog}>記録</button>
      </div>
      <div className="uz-note">「、」区切りでまとめて入力。数字は数量（卵10）。リスト外・登録外の品もこのまま在庫に入ります。</div>

      <div style={{ marginTop: 16 }}>
        <button className="uz-ai-btn" style={{ background: "#4A5568" }} onClick={suggestIdeas} disabled={ideaLoading}>
          <span className="uz-ai-icon">{ideaLoading ? <span className="uz-spin">◐</span> : "💡"}</span>
          <span>
            <div className="uz-ai-title">これ買えば、あれ作れる？</div>
            <div className="uz-ai-sub">家の在庫×買い足し1〜2品でできる料理をAIが提案</div>
          </span>
        </button>
        {ideas && ideas.length === 0 && <div className="uz-note">提案を取得できませんでした。もう一度お試しください。</div>}
        {ideas && ideas.map((idea, i) => (
          <div className="uz-idea" key={i}>
            <b>{Array.isArray(idea.buy) ? idea.buy.join("・") : idea.buy}</b> を買えば、家の{(idea.withHome || []).join("・")}で <b>{idea.dish}</b> が作れます。
            <div style={{ marginTop: 6 }}><button className="uz-ghost" onClick={() => missingToList(Array.isArray(idea.buy) ? idea.buy : [idea.buy])}>リストに追加</button></div>
          </div>
        ))}
      </div>

      {snoozedList.length > 0 && (<>
        <div className="uz-group-label">見送り中</div>
        <div className="uz-card">
          {snoozedList.map(it => (
            <div className="uz-row" key={it.id}>
              <div className="uz-row-main"><div className="uz-row-title" style={{ color: "#8A8D9C" }}>{it.name}</div><div className="uz-row-sub">{it.snoozeUntil} に再提案</div></div>
              <button className="uz-ghost" onClick={() => unsnooze(it)}>戻す</button>
            </div>
          ))}
        </div>
      </>)}
    </>
  );

  const MenuPage = (
    <>
      <div className="uz-brandrow"><span className="uz-logo">Z</span><span className="uz-brand">UCHI-NO-ZAIKO</span></div>
      <div className="uz-page-title">献立</div>
      <div className="uz-mascot-row">
        <ZaikoKun size={66} />
        <div className="uz-bubble">今夜はなに作る？家にあるもので考えるよ〜！</div>
      </div>
      <div className="uz-page-sub">いま家にある（と推定される）食材：{inventoryText() || "なし"}</div>
      <button className="uz-ai-btn" onClick={suggestMenus} disabled={menuLoading}>
        <span className="uz-ai-icon">{menuLoading ? <span className="uz-spin">◐</span> : "🍳"}</span>
        <span>
          <div className="uz-ai-title">{menuLoading ? "考えています…" : "あまり食材で献立を提案してもらう"}</div>
          <div className="uz-ai-sub">残り日数が少ない食材を優先して使い切ります</div>
        </span>
      </button>
      {menus && menuSource === "local" && menus.length > 0 && data.aiEnabled && (
        <div className="uz-note" style={{ marginTop: 0, marginBottom: 10 }}>⚠️ AIに接続できなかったため、内蔵レシピから提案しています。</div>
      )}
      {menus && menus.length === 0 && <div className="uz-empty">うーん、いい献立が思いつかない…食材を追加してもう一回きいてみて！</div>}
      {menus && menus.map((m, i) => (
        <div className="uz-menu-card" key={i}>
          <div className="uz-menu-name">{m.name}</div>
          {(m.point || m.time) && <div className="uz-menu-point">{m.point}{m.time ? `（${m.time}）` : ""}</div>}
          <div className="uz-menu-line">
            使う食材：{(m.uses || []).map(u => <span className="uz-ing" key={u}>{u}</span>)}
            {(m.missing || []).length > 0 && <><br />買い足し：{m.missing.map(u => <span className="uz-ing miss" key={u}>{u}</span>)}</>}
          </div>
          {Array.isArray(m.steps) && m.steps.length > 0 && (
            <ol className="uz-steps">{m.steps.map((st, j) => <li key={j}>{st}</li>)}</ol>
          )}
          {(m.missing || []).length > 0 && <div style={{ marginTop: 8 }}><button className="uz-ghost" onClick={() => missingToList(m.missing)}>買い足しをリストへ</button></div>}
        </div>
      ))}
    </>
  );

  const CheckPage = (
    <>
      <div className="uz-brandrow"><span className="uz-logo">Z</span><span className="uz-brand">UCHI-NO-ZAIKO</span></div>
      <div className="uz-page-title">棚卸し</div>
      <div className="uz-mascot-row">
        <ZaikoKun size={66} />
        <div className="uz-bubble">ボクの予想と答え合わせ！実際に残ってる数に直してね</div>
      </div>
      <div className="uz-page-sub">実際の残量に合わせて数字を直してください（表示は現在の推定値）。差から消費ペースを学習し、予測が週ごとに正確になります。</div>
      {["food", "daily"].map(cat => {
        const group = items.filter(i => i.cat === cat && i.kind !== "pantry");
        if (group.length === 0) return null;
        return (
          <div key={cat}>
            <div className="uz-group-label">{catIcon(cat)} {CAT_LABEL[cat]}</div>
            <div className="uz-card">
              {group.map(it => {
                const v = checkDraft && checkDraft[it.id] !== undefined ? checkDraft[it.id] : it.est;
                const diff = r1(v - it.est);
                return (
                  <div className="uz-row" key={it.id}>
                    <div className="uz-row-main">
                      <div className="uz-row-title">{it.name}</div>
                      <div className="uz-row-sub">推定 {it.est}{it.unit}{diff !== 0 && <span style={{ color: diff > 0 ? "#5A8A6A" : "#C0763B" }}>（{diff > 0 ? `+${diff}` : diff} 補正）</span>}</div>
                    </div>
                    <div className="uz-step">
                      <button onClick={() => stepDraft(it.id, -stepOf(it.unit))}>−</button>
                      <div className="uz-step-val">{v}<small>{it.unit}</small></div>
                      <button onClick={() => stepDraft(it.id, +stepOf(it.unit))}>＋</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <button className="uz-btn wide" onClick={saveCheck}>この内容で確定する</button>
      <button className="uz-ghost" style={{ width: "100%", marginTop: 8, padding: 12 }} onClick={() => { setCheckDraft(null); setTab("stock"); }}>キャンセル</button>
      <div className="uz-note">前回：{data.lastCheck || "なし"}（{sinceCheck}日前）。週1回程度・タイミング自由。</div>
    </>
  );

  const SettingsPage = (
    <>
      <div className="uz-brandrow"><span className="uz-logo">Z</span><span className="uz-brand">UCHI-NO-ZAIKO</span></div>
      <div className="uz-page-title">設定</div>
      <div className="uz-mascot-row">
        <ZaikoKun size={66} />
        <div className="uz-bubble">ここでボクの調整ができるよ。バックアップも忘れずにね！</div>
      </div>
      <div className="uz-group-label">品目の管理</div>
      <div className="uz-card">
        {data.items.map(it => (
          <div className="uz-row" key={it.id}>
            <div className="uz-row-main">
              <div className="uz-row-title">{itemIcon(it)} {it.name}</div>
              <div className="uz-row-sub">{it.kind === "pantry" ? "常備品（減らない扱い）" : `約${r1(it.ratePerDay)}${it.unit}/日ペース`}</div>
            </div>
            <button
              className="uz-ghost"
              style={it.kind === "regular" ? { borderColor: "#FF7A59", color: "#FF7A59", fontWeight: 800 } : it.kind === "pantry" ? { borderColor: "#2FBFA0", color: "#2FBFA0", fontWeight: 800 } : {}}
              onClick={() => persist({ ...data, items: data.items.map(x => x.id === it.id ? { ...x, kind: x.kind === "regular" ? "oneoff" : x.kind === "oneoff" ? "pantry" : "regular", ratePerDay: x.kind === "oneoff" ? 0 : (x.ratePerDay || 0.3) } : x) })}
            >{it.kind === "oneoff" ? "都度" : it.kind === "pantry" ? "常備" : "定番"}</button>
            <button className="uz-del" onClick={() => delItem(it.id)}>×</button>
          </div>
        ))}
      </div>
      <div className="uz-note">「定番」は切れそうになると買い物提案に並びます。「都度」は使い切ったら静かに消えます（催促しません）。タップで「定番→都度→常備」と切替。常備＝調味料などずっとある扱い。</div>

      <div className="uz-group-label">献立・買い足しの提案エンジン</div>
      <div className="uz-card">
        <div className="uz-row">
          <div className="uz-row-main">
            <div className="uz-row-title">AI提案</div>
            <div className="uz-row-sub">ONでClaude APIによる提案（サーバー経由）。OFFまたは接続失敗時は内蔵レシピ（約50品）から提案します。</div>
          </div>
          <button
            className="uz-ghost"
            style={data.aiEnabled ? { borderColor: "#5C6BC0", color: "#5C6BC0", fontWeight: 700 } : {}}
            onClick={() => persist({ ...data, aiEnabled: !data.aiEnabled })}
          >{data.aiEnabled ? "ON" : "OFF"}</button>
        </div>
      </div>

      <div className="uz-group-label">バックアップ</div>
      <div className="uz-note" style={{ marginTop: 0, marginBottom: 8 }}>Safariとホーム画面アプリは保存場所が別です。引っ越しや万一に備えて、たまにバックアップをコピーして保存しておくと安心です。</div>
      <button className="uz-ghost" style={{ width: "100%", padding: 13 }} onClick={async () => {
        try { await navigator.clipboard.writeText(JSON.stringify(data)); showToast("バックアップをコピーしました（メモ帳などに貼って保存）"); }
        catch (e) { setImportText(JSON.stringify(data)); showToast("下の欄に表示しました。全選択してコピーしてください"); }
      }}>📋 データをコピー（バックアップ）</button>
      <textarea className="uz-textarea" style={{ marginTop: 8 }} placeholder="復元するときは、ここにバックアップを貼り付けて下のボタン" value={importText} onChange={e => setImportText(e.target.value)} />
      <button className="uz-ghost" style={{ width: "100%", padding: 13, marginTop: 6 }} onClick={() => {
        try {
          const parsed = JSON.parse(importText);
          if (!parsed || !Array.isArray(parsed.items)) throw new Error("形式が違います");
          persist({ ...DEFAULT_DATA, ...parsed });
          setImportText("");
          showToast("復元しました！");
        } catch (e) { showToast("復元できませんでした。コピーした文字をそのまま貼ってください"); }
      }}>♻️ 貼り付けたデータで復元</button>

      <div className="uz-group-label">データ</div>
      <button
        className="uz-ghost"
        style={{ width: "100%", padding: 13, color: "#B4504A", borderColor: "#E8C9C6" }}
        onClick={async () => {
          if (!window.confirm("在庫データをすべて消して、初回セットアップからやり直します。よろしいですか？")) return;
          await persist({ ...DEFAULT_DATA });
          setCheckDraft(null); setMenus(null); setIdeas(null); setShopQty({});
          setTab("stock");
        }}
      >🗑 在庫データをリセット（1からやり直す）</button>
    </>
  );

  return (
    <div className="uz">
      <style>{css}</style>
      <div className="uz-wrap">
        {tab === "stock" && StockPage}
        {tab === "shop" && ShopPage}
        {tab === "menu" && MenuPage}
        {tab === "check" && CheckPage}
        {tab === "settings" && SettingsPage}
      </div>

      <nav className="uz-tabs">
        <button className={`uz-tab ${tab === "stock" || tab === "check" ? "on" : ""}`} onClick={() => setTab("stock")}>
          <span className="uz-tab-icon">📦</span>在庫
          {checkDue && <span className="uz-tab-badge">!</span>}
        </button>
        <button className={`uz-tab ${tab === "shop" ? "on" : ""}`} onClick={() => setTab("shop")}>
          <span className="uz-tab-icon">🧺</span>買い物
          {shopCount > 0 && <span className="uz-tab-badge">{shopCount}</span>}
        </button>
        <button className={`uz-tab ${tab === "menu" ? "on" : ""}`} onClick={() => setTab("menu")}><span className="uz-tab-icon">🍳</span>献立</button>
        <button className={`uz-tab ${tab === "settings" ? "on" : ""}`} onClick={() => setTab("settings")}><span className="uz-tab-icon">⚙️</span>設定</button>
      </nav>

      {toast && <div className="uz-toast">{toast}</div>}
    </div>
  );
}
