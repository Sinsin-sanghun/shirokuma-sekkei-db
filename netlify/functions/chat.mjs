// ============================================================
// chat.mjs - Netlify Functions 2.0 (Streaming + Tool Use)
// shirokuma-sekkei-db - 設計・工事チーム 部材情報DB
// v3: SSEストリーミング + &文字修正 + 品質向上
// ============================================================
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `あなたは「しろくま電力」設計・工事チームの部材情報アシスタントです。太陽光発電所の設計・施工に使用する部材・資材の検索、比較、スペック確認をサポートします。

## 最重要ルール
- **ツール検索結果が空でも、関連カテゴリ・類似キーワードで再検索すること**
- 「登録されていません」と即答するな。必ず2通り以上の検索を試みてから判断する
- 検索結果がある場合は、必ずそのデータを使って回答する。推測データを作るな
- 回答は **プレーンテキスト（Markdown可）** で返す。HTMLタグは使わない
- テーブルはMarkdown記法（| col1 | col2 |）で書く
- 金額は「¥」と3桁カンマ区切り（例: ¥4,200,000）
- unit_priceがnull/0/未設定の資材は「要見積」と表記する
- DBに無い情報は「DBに未登録」と明示
- 推測は「推定」と明記

## DB構造（materialsテーブル）
id, product_name(品名), major_category(大分類), sub_category(小分類), maker(メーカー), unit_price(単価), unit(単位), qty(数量), total_price(合計), supplier(仕入先), estimate_date(見積日), estimate_no(見積番号), project(案件名), note(備考), desc1(資材説明), desc2(用途), desc3(リードタイム), desc5(影響度), desc6(スペック詳細テーブル)

### desc6の重要性
desc6には「導体断面積」「定格電圧」「定格出力」「効率」「寸法」「重量」等のスペック情報がHTMLテーブルで格納されている。

## 検索戦略（重要）
1. まず search_materials で全文検索
2. 結果が少なければ get_materials_by_category でカテゴリ検索も試す
3. 部分キーワード（例: "O&M"→"メンテナンス"、"PCS"→"パワコン"等）で追加検索
4. **1回のツール呼び出しで必要なデータを可能な限り取得する**

## 回答スタイル
- 最初に簡潔な要約（2-3行）
- データはMarkdownテーブルで見やすく整理
- スペック情報、リードタイム、注意点を含める
- 日本語で丁寧に回答。韓国語で質問された場合は韓国語で回答`;

const TOOLS = [
  { name: "search_materials", description: "資材を検索。品名,カテゴリ,メーカー,仕入先等で部分一致検索。結果にはdesc1(説明)とdesc6(スペック詳細)が含まれる。", input_schema: { type: "object", properties: { query: { type: "string", description: "検索キーワード" }, field: { type: "string", enum: ["product_name","major_category","sub_category","maker","supplier","project","all"], default: "all" }, limit: { type: "integer", default: 30 } }, required: ["query"] } },
  { name: "get_material_by_id", description: "IDで資材の全フィールドを取得", input_schema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] } },
  { name: "get_category_list", description: "大分類の一覧と各件数を取得", input_schema: { type: "object", properties: {} } },
  { name: "get_materials_by_category", description: "指定カテゴリの資材一覧を取得", input_schema: { type: "object", properties: { category: { type: "string", description: "大分類名" }, sort_by: { type: "string", enum: ["unit_price","product_name","maker"], default: "product_name" }, limit: { type: "integer", default: 50 } }, required: ["category"] } },
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

// PostgREST URL에서 & 문자가 쿼리 파라미터 구분자로 해석되는 문제 수정
function safeEncode(query) {
  return encodeURIComponent(query.replace(/[&＆]/g, '*'));
}

// === Tool implementations ===
const SEL = "select=id,product_name,major_category,sub_category,maker,unit_price,unit,qty,total_price,supplier,estimate_date,note,project,desc1,desc6";

async function searchMaterials(query, field = "all", limit = 30) {
  const q = safeEncode(query);
  if (field === "all") return sb(`materials?${SEL}&or=(product_name.ilike.*${q}*,major_category.ilike.*${q}*,sub_category.ilike.*${q}*,maker.ilike.*${q}*,supplier.ilike.*${q}*,note.ilike.*${q}*,desc1.ilike.*${q}*)&limit=${limit}&order=product_name`);
  return sb(`materials?${SEL}&${field}=ilike.*${q}*&limit=${limit}&order=product_name`);
}

async function getMaterialById(id) { return sb(`materials?id=eq.${id}&select=*`); }

async function getCategoryList() {
  const data = await sb("materials?select=major_category&order=major_category");
  if (Array.isArray(data)) { const cats = {}; data.forEach(r => { const c = r.major_category || "未分類"; cats[c] = (cats[c] || 0) + 1; }); return Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ category: k, count: v })); }
  return data;
}

async function getMaterialsByCategory(category, sortBy = "product_name", limit = 50) {
  const q = safeEncode(category);
  return sb(`materials?${SEL}&major_category=ilike.*${q}*&order=${sortBy}.asc.nullslast&limit=${limit}`);
}

async function findMat(ident) {
  const id = parseInt(ident);
  if (!isNaN(id)) { const r = await sb(`materials?id=eq.${id}&select=*`); if (Array.isArray(r) && r.length) return r; }
  const q = safeEncode(ident);
  return sb(`materials?product_name=ilike.*${q}*&select=*&limit=5`);
}

async function compareMaterials(a, b) { const [ra, rb] = await Promise.all([findMat(a), findMat(b)]); return { material_a: Array.isArray(ra) && ra.length ? ra[0] : null, material_b: Array.isArray(rb) && rb.length ? rb[0] : null }; }

async function getSuppliers() {
  const data = await sb("materials?select=supplier,major_category&order=supplier");
  if (Array.isArray(data)) { const sups = {}; data.forEach(r => { const s = r.supplier || "不明"; if (!sups[s]) sups[s] = { count: 0, cats: {} }; sups[s].count++; const c = r.major_category || "未分類"; sups[s].cats[c] = (sups[s].cats[c] || 0) + 1; }); return Object.entries(sups).sort((a, b) => b[1].count - a[1].count).map(([name, info]) => ({ supplier: name, total: info.count, top_categories: Object.entries(info.cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => ({ category: c, count: n })) })); }
  return data;
}

async function priceStatistics(category) {
  const q = safeEncode(category);
  const data = await sb(`materials?major_category=ilike.*${q}*&select=product_name,unit_price,unit,maker,supplier&order=unit_price.asc.nullslast`);
  if (Array.isArray(data) && data.length) { const prices = data.filter(r => r.unit_price && r.unit_price > 0).map(r => r.unit_price).sort((a, b) => a - b); if (prices.length) { const n = prices.length; return { category, count: data.length, price_count: n, min: Math.min(...prices), max: Math.max(...prices), average: Math.round(prices.reduce((s, p) => s + p, 0) / n), median: n % 2 ? prices[Math.floor(n / 2)] : (prices[n / 2 - 1] + prices[n / 2]) / 2, items: data }; } }
  return { category, count: 0, message: "該当データなし" };
}

async function executeTool(name, input) {
  switch (name) {
    case "search_materials": return searchMaterials(input.query || "", input.field || "all", input.limit || 30);
    case "get_material_by_id": return getMaterialById(input.id || 0);
    case "get_category_list": return getCategoryList();
    case "get_materials_by_category": return getMaterialsByCategory(input.category || "", input.sort_by || "product_name", input.limit || 50);
    case "compare_materials": return compareMaterials(input.material_a || "", input.material_b || "");
    case "get_suppliers": return getSuppliers();
    case "price_statistics": return priceStatistics(input.category || "");
    default: return { error: `Unknown tool: ${name}` };
  }
}

// === CORS Headers ===
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// === Netlify Functions 2.0 Handler (streaming from start to avoid timeout) ===
export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers: CORS });
  }

  let bodyParsed;
  try { bodyParsed = await req.json(); } catch { bodyParsed = {}; }
  const msg = bodyParsed.message || "";
  const hist = bodyParsed.history || [];

  if (!msg) {
    return new Response(JSON.stringify({ error: "empty message" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      const sendText = (t) => send({ type: "content_block_delta", delta: { type: "text_delta", text: t } });

      try {
        const messages = hist.slice(-6).map(h => ({ role: h.role, content: h.content }));
        messages.push({ role: "user", content: msg });

        const apiHeaders = {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        };

        // Keep-alive: 연결 즉시 열림 → Netlify 타임아웃 회피
        send({ type: "ping" });

        // === 1st call: with tools (non-streaming) ===
        const res1 = await fetch(ANTHROPIC_API_URL, {
          method: "POST", headers: apiHeaders,
          body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4096, system: SYSTEM_PROMPT, tools: TOOLS, messages })
        });

        if (!res1.ok) {
          const txt = await res1.text();
          sendText("⚠️ APIエラー: " + txt.slice(0, 200));
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const result1 = await res1.json();

        // No tool use → send text directly
        if (result1.stop_reason !== "tool_use") {
          const text = (result1.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
          sendText(text || "応答なし");
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        // === Execute tools ===
        const toolBlocks = result1.content.filter(b => b.type === "tool_use");
        console.log(`[Tools] ${toolBlocks.map(b => b.name).join(", ")}`);
        send({ type: "ping" }); // keep-alive

        const toolResults = await Promise.all(toolBlocks.map(async (block) => {
          const output = await executeTool(block.name, block.input);
          return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(output).slice(0, 12000) };
        }));

        messages.push({ role: "assistant", content: result1.content });
        messages.push({ role: "user", content: toolResults });
        send({ type: "ping" }); // keep-alive

        // === 2nd call: check if more tools needed ===
        const res2 = await fetch(ANTHROPIC_API_URL, {
          method: "POST", headers: apiHeaders,
          body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4096, system: SYSTEM_PROMPT, tools: TOOLS, messages })
        });

        if (!res2.ok) {
          sendText("⚠️ 2次APIエラー");
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const result2 = await res2.json();

        if (result2.stop_reason === "tool_use") {
          // 2nd round tools
          const tb2 = result2.content.filter(b => b.type === "tool_use");
          console.log(`[Tools 2nd] ${tb2.map(b => b.name).join(", ")}`);
          send({ type: "ping" });
          const tr2 = await Promise.all(tb2.map(async (block) => {
            const output = await executeTool(block.name, block.input);
            return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(output).slice(0, 12000) };
          }));
          messages.push({ role: "assistant", content: result2.content });
          messages.push({ role: "user", content: tr2 });
          send({ type: "ping" });

          // Final call (non-streaming to avoid empty content issue)
          const resFinal = await fetch(ANTHROPIC_API_URL, {
            method: "POST", headers: apiHeaders,
            body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4096, system: SYSTEM_PROMPT, messages })
          });
          if (resFinal.ok) {
            const resultFinal = await resFinal.json();
            const finalText = (resultFinal.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
            sendText(finalText || "応答なし");
          } else {
            sendText("⚠️ 最終APIエラー");
          }
        } else {
          // 2nd call returned text → send it
          const text = (result2.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
          sendText(text || "応答なし");
        }

        controller.enqueue(enc.encode("data: [DONE]\n\n"));
        controller.close();

      } catch (e) {
        console.error("Stream error:", e);
        sendText("⚠️ エラー: " + e.message);
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      ...CORS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    }
  });
};
