// ============================================================
// chat.js - Netlify Serverless Function
// Claude API (Anthropic) AI Chat with Supabase DB connectivity
// shirokuma-sekkei-db - Design & Construction Materials DB
// ============================================================
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `あなたは「しろくま電力」設計・工事チームの部材情報アシスタントです。太陽光発電所の設計・施工に使用する部材・資材の検索、比較、スペック確認をサポートします。

## 重要ルール
- 回答は **プレーンテキスト（Markdown可）** で返す。HTMLタグは使わない。
- テーブルはMarkdown記法（| col1 | col2 |）で書く。
- 金額は「¥」と3桁カンマ区切り（例: ¥4,200,000）
- unit_priceがnull/0/未設定の資材は「要見積」と表記する
- DBに無い情報は「DBに未登録」と明示
- 推測は「推定」と明記

## DB構造（materialsテーブル）
id, product_name(品名), major_category(大分類), sub_category(小分類), maker(メーカー), unit_price(単価), unit(単位), qty(数量), total_price(合計), supplier(仕入先), estimate_date(見積日), estimate_no(見積番号), project(案件名), note(備考), desc1(資材説明), desc2(用途), desc3(リードタイム), desc5(影響度), desc6(スペック詳細テーブル)

### desc6の重要性
desc6には「導体断面積」「定格電圧」「定格出力」「効率」「寸法」「重量」等のスペック情報がHTMLテーブルで格納されている。
比較時には必ずdesc6のスペック情報を参照し、比較前提を揃えること。

## 設計チーム向け重点事項
- スペック（定格電圧、断面積、効率、寸法等）を正確に回答
- 代替品・互換品の提案を積極的に行う
- リードタイム(desc3)がある場合は必ず言及する
- 案件(project)ごとの使用実績を参照可能

## 回答スタイル
- 最初に簡潔な要約（2-3行）
- スペック情報は見やすく整理
- 必要に応じて注意点・推奨事項
- 日本語で丁寧に回答。韓国語で質問された場合は韓国語で回答

## ツール使用の効率化
- 1回の回答に使うツール呼び出しは最大3回まで
- 必要なデータは可能な限り1-2回の検索で取得する`;

const TOOLS = [
  { name: "search_materials", description: "資材を検索。品名,カテゴリ,メーカー,仕入先等で部分一致検索。結果にはdesc1(説明)とdesc6(スペック詳細)が含まれる。", input_schema: { type: "object", properties: { query: { type: "string", description: "検索キーワード" }, field: { type: "string", enum: ["product_name","major_category","sub_category","maker","supplier","project","all"], default: "all" }, limit: { type: "integer", default: 30 } }, required: ["query"] } },
  { name: "get_material_by_id", description: "IDで資材の全フィールドを取得", input_schema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] } },
  { name: "get_category_list", description: "大分類の一覧と各件数を取得", input_schema: { type: "object", properties: {} } },
  { name: "get_materials_by_category", description: "指定カテゴリの資材一覧を取得", input_schema: { type: "object", properties: { category: { type: "string", description: "大分類名" }, sort_by: { type: "string", enum: ["unit_price","product_name","maker"], default: "product_name" }, limit: { type: "integer", default: 100 } }, required: ["category"] } },
  { name: "compare_materials", description: "2つの資材を比較。品名で指定。全フィールド(desc1,desc6含む)を返す。", input_schema: { type: "object", properties: { material_a: { type: "string" }, material_b: { type: "string" } }, required: ["material_a", "material_b"] } },
  { name: "get_suppliers", description: "仕入先一覧と取扱品目数", input_schema: { type: "object", properties: {} } },
  { name: "price_statistics", description: "指定カテゴリの価格統計（平均,最小,最大,中央値）", input_schema: { type: "object", properties: { category: { type: "string" } }, required: ["category"] } }
];

// === Supabase helper ===
async function sb(path) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${path}`;
  try {
    const res = await fetch(url, { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`, "Content-Type": "application/json" } });
    if (!res.ok) { const txt = await res.text(); return { error: `HTTP ${res.status}: ${txt.slice(0, 200)}` }; }
    return await res.json();
  } catch (e) { return { error: e.message }; }
}

// === Tool implementations ===
const SEL = "select=id,product_name,major_category,sub_category,maker,unit_price,unit,qty,total_price,supplier,estimate_date,note,project,desc1,desc6";

async function searchMaterials(query, field = "all", limit = 30) {
  const q = encodeURIComponent(query);
  if (field === "all") return sb(`materials?${SEL}&or=(product_name.ilike.*${q}*,major_category.ilike.*${q}*,sub_category.ilike.*${q}*,maker.ilike.*${q}*,supplier.ilike.*${q}*,note.ilike.*${q}*,desc1.ilike.*${q}*)&limit=${limit}&order=product_name`);
  return sb(`materials?${SEL}&${field}=ilike.*${q}*&limit=${limit}&order=product_name`);
}

async function getMaterialById(id) { return sb(`materials?id=eq.${id}&select=*`); }

async function getCategoryList() {
  const data = await sb("materials?select=major_category&order=major_category");
  if (Array.isArray(data)) { const cats = {}; data.forEach(r => { const c = r.major_category || "未分類"; cats[c] = (cats[c] || 0) + 1; }); return Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ category: k, count: v })); }
  return data;
}

async function getMaterialsByCategory(category, sortBy = "product_name", limit = 100) {
  const q = encodeURIComponent(category);
  return sb(`materials?${SEL}&major_category=ilike.*${q}*&order=${sortBy}.asc.nullslast&limit=${limit}`);
}

async function findMat(ident) {
  const id = parseInt(ident);
  if (!isNaN(id)) { const r = await sb(`materials?id=eq.${id}&select=*`); if (Array.isArray(r) && r.length) return r; }
  const q = encodeURIComponent(ident);
  return sb(`materials?product_name=ilike.*${q}*&select=*&limit=5`);
}

async function compareMaterials(a, b) { const [ra, rb] = await Promise.all([findMat(a), findMat(b)]); return { material_a: Array.isArray(ra) && ra.length ? ra[0] : null, material_b: Array.isArray(rb) && rb.length ? rb[0] : null }; }

async function getSuppliers() {
  const data = await sb("materials?select=supplier,major_category&order=supplier");
  if (Array.isArray(data)) { const sups = {}; data.forEach(r => { const s = r.supplier || "不明"; if (!sups[s]) sups[s] = { count: 0, cats: {} }; sups[s].count++; const c = r.major_category || "未分類"; sups[s].cats[c] = (sups[s].cats[c] || 0) + 1; }); return Object.entries(sups).sort((a, b) => b[1].count - a[1].count).map(([name, info]) => ({ supplier: name, total: info.count, top_categories: Object.entries(info.cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => ({ category: c, count: n })) })); }
  return data;
}

async function priceStatistics(category) {
  const q = encodeURIComponent(category);
  const data = await sb(`materials?major_category=ilike.*${q}*&select=product_name,unit_price,unit,maker,supplier&order=unit_price.asc.nullslast`);
  if (Array.isArray(data) && data.length) { const prices = data.filter(r => r.unit_price && r.unit_price > 0).map(r => r.unit_price).sort((a, b) => a - b); if (prices.length) { const n = prices.length; return { category, count: data.length, price_count: n, min: Math.min(...prices), max: Math.max(...prices), average: Math.round(prices.reduce((s, p) => s + p, 0) / n), median: n % 2 ? prices[Math.floor(n / 2)] : (prices[n / 2 - 1] + prices[n / 2]) / 2, items: data }; } }
  return { category, count: 0, message: "該当データなし" };
}

async function executeTool(name, input) {
  switch (name) {
    case "search_materials": return searchMaterials(input.query || "", input.field || "all", input.limit || 30);
    case "get_material_by_id": return getMaterialById(input.id || 0);
    case "get_category_list": return getCategoryList();
    case "get_materials_by_category": return getMaterialsByCategory(input.category || "", input.sort_by || "product_name", input.limit || 100);
    case "compare_materials": return compareMaterials(input.material_a || "", input.material_b || "");
    case "get_suppliers": return getSuppliers();
    case "price_statistics": return priceStatistics(input.category || "");
    default: return { error: `Unknown tool: ${name}` };
  }
}

// === Claude API: Tool use loop (non-streaming) then streaming final response ===
async function processToolUse(messages, maxIter) {
  for (let i = 0; i < maxIter; i++) {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4096, system: SYSTEM_PROMPT, tools: TOOLS, messages }),
    });

    if (!res.ok) { const txt = await res.text(); return { error: `Claude API error ${res.status}: ${txt.slice(0, 500)}` }; }
    const result = await res.json();
    const content = result.content || [];

    if (result.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content });
      const toolResults = [];
      for (const block of content) {
        if (block.type === "tool_use") {
          console.log(`[Tool] ${block.name}(${JSON.stringify(block.input).slice(0, 80)})`);
          const output = await executeTool(block.name, block.input);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(output).slice(0, 12000) });
        }
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    return { done: true, messages };
  }
  return { error: "Max iterations exceeded" };
}

// === Handler ===
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    const body = JSON.parse(event.body);
    const msg = body.message || "";
    const hist = body.history || [];

    if (!msg) return { statusCode: 400, headers, body: JSON.stringify({ error: "empty message" }) };

    const messages = hist.slice(-8).map(h => ({ role: h.role, content: h.content }));
    messages.push({ role: "user", content: msg });

    // Phase 1: Process tool use loop (non-streaming)
    const toolResult = await processToolUse(messages, 10);

    if (toolResult.error) {
      return { statusCode: 500, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: toolResult.error }) };
    }

    // Phase 2: Final API call (non-streaming) to get text response
    const finalRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: toolResult.messages,
      }),
    });

    if (!finalRes.ok) {
      const errText = await finalRes.text();
      return { statusCode: finalRes.status, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: `API error: ${finalRes.status}` }) };
    }

    const finalResult = await finalRes.json();
    const textBlocks = (finalResult.content || []).filter(b => b.type === "text").map(b => b.text);
    const responseText = textBlocks.join("\n") || "応答を生成できませんでした";

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ response: responseText }),
    };
  } catch (e) {
    console.error("Function error:", e);
    return { statusCode: 500, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: e.message }) };
  }
};
