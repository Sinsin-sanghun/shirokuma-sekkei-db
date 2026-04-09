/**
 * AI Chatbot Widget - shirokuma-sekkei-db
 * Bottom input bar + Right side panel design
 * + Excel table view & download feature
 */
(function () {
  if (document.getElementById("ai-chat-bar")) return;

  /* ── Config ── */
  const API = "/api/chat";
  const TITLE = "\u{1F916} AI\u90E8\u6750\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8";
  const PLACEHOLDER = "AI\u306B\u8CEA\u554F\uFF08\u4F8B: \u304A\u3059\u3059\u3081\u306E\u90E8\u6750\u306F\uFF1F \u5728\u5EAB\u306E\u8A73\u7D30\u306F\uFF1F\uFF09";
  const FOOTER_TEXT = "Claude AI \u304CDB\u3092\u691C\u7D22\u3057\u3066\u56DE\u7B54\u3057\u307E\u3059\u3002";
  const ACCENT = "#3b82f6";
  const ACCENT_HOVER = "#2563eb";
  const ACCENT_LIGHT = "#60a5fa";
  const ACCENT_PALE = "#93c5fd";

  /* ── Load SheetJS for Excel export ── */
  if (!window.XLSX) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    document.head.appendChild(s);
  }

  /* ── Styles ── */
  const style = document.createElement("style");
  style.textContent = `
    /* Bottom Bar */
    .ai-chat-bar{position:fixed;bottom:0;left:0;right:0;z-index:9998;
      background:#0f172a;border-top:1px solid #334155;padding:12px 20px;
      display:flex;flex-direction:column;gap:4px;}
    .ai-chat-row{display:flex;gap:8px;align-items:center;}
    .ai-chat-bar input{flex:1;padding:10px 14px;border-radius:8px;border:1px solid #334155;
      background:#1e293b;color:#e2e8f0;font-size:14px;outline:none;}
    .ai-chat-bar input:focus{border-color:${ACCENT_LIGHT};}
    .ai-chat-bar input::placeholder{color:#94a3b8;}
    .ai-chat-bar button{padding:10px 20px;border-radius:8px;border:none;
      background:${ACCENT};color:#fff;font-size:14px;cursor:pointer;white-space:nowrap;}
    .ai-chat-bar button:hover{background:${ACCENT_HOVER};}
    .ai-chat-bar .ai-footer{font-size:11px;color:#64748b;text-align:center;}

    /* Right Panel */
    .ai-panel{position:fixed;top:0;right:0;bottom:0;width:400px;z-index:9997;
      background:#1e293b;border-left:1px solid #334155;display:flex;flex-direction:column;
      transform:translateX(100%);transition:transform .3s ease;}
    .ai-panel.vis{transform:translateX(0);}
    .ai-panel-hdr{display:flex;justify-content:space-between;align-items:center;
      padding:14px 18px;background:#0f172a;color:#e2e8f0;font-weight:700;font-size:15px;
      border-bottom:1px solid #334155;}
    .ai-panel-hdr button{background:none;border:none;color:#94a3b8;font-size:20px;
      cursor:pointer;line-height:1;}
    .ai-panel-hdr button:hover{color:#e2e8f0;}
    .ai-panel-body{flex:1;overflow-y:auto;padding:18px;color:#e2e8f0;font-size:14px;
      line-height:1.7;}
    .ai-panel-body .ai-welcome{color:#94a3b8;margin-top:40px;text-align:center;line-height:1.9;}
    .ai-panel-body .ai-msg{margin-bottom:16px;padding:12px;border-radius:8px;}
    .ai-panel-body .ai-msg.user{background:#334155;text-align:right;}
    .ai-panel-body .ai-msg.assistant{background:#0f172a;}
    .ai-panel-body .ai-msg.assistant h3{color:${ACCENT_LIGHT};font-size:14px;margin:12px 0 4px;}
    .ai-panel-body .ai-msg.assistant ul{margin:4px 0 4px 18px;}
    .ai-panel-body .ai-msg.assistant li{margin:2px 0;}
    .ai-panel-body .ai-msg.assistant code{background:#334155;padding:1px 5px;border-radius:3px;font-size:13px;}
    .ai-panel-body .ai-msg.assistant strong{color:${ACCENT_PALE};}
    .ai-panel-body .ai-loading{color:#94a3b8;padding:12px;text-align:center;}

    /* Resize handle */
    .ai-resize{position:fixed;top:0;bottom:0;width:5px;right:400px;z-index:9999;
      cursor:col-resize;background:transparent;display:none;}
    .ai-panel.vis~.ai-resize{display:block;}
    .ai-resize:hover{background:#334155;}

    /* Push content when panel open */
    body.ai-panel-open{margin-right:400px;transition:margin .3s ease;}

    /* Prevent bottom content from being hidden behind fixed chat bar */
    body{padding-bottom:70px !important;}

    /* ── Excel Table Styles ── */
    .ai-table-wrap{overflow-x:auto;margin:10px 0;border-radius:6px;border:1px solid #334155;}
    .ai-table-wrap table{width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap;}
    .ai-table-wrap th{background:#0f172a;color:${ACCENT_LIGHT};padding:8px 10px;
      text-align:left;border-bottom:2px solid ${ACCENT};font-weight:600;position:sticky;top:0;}
    .ai-table-wrap td{padding:6px 10px;border-bottom:1px solid #334155;color:#e2e8f0;}
    .ai-table-wrap tr:hover td{background:#334155;}
    .ai-table-wrap .ai-table-container{max-height:300px;overflow-y:auto;}

    /* Excel Buttons */
    .ai-excel-btns{display:flex;gap:6px;margin:8px 0 4px;flex-wrap:wrap;}
    .ai-excel-btns button{padding:6px 12px;border-radius:6px;border:1px solid #334155;
      background:#1e293b;color:#e2e8f0;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;}
    .ai-excel-btns button:hover{background:#334155;border-color:${ACCENT};}
    .ai-excel-btns button svg{width:14px;height:14px;}

    /* ── Mobile Responsive ── */
    @media(max-width:768px){
      body{padding-bottom:56px !important;}
      .ai-chat-bar{padding:6px 10px;gap:2px;}
      .ai-chat-row{gap:6px;}
      .ai-chat-bar input{padding:8px 10px;font-size:13px;border-radius:6px;}
      .ai-chat-bar button{padding:8px 14px;font-size:13px;border-radius:6px;}
      .ai-chat-bar .ai-footer{font-size:10px;}

      .ai-panel{width:100vw !important;}
      .ai-panel-hdr{padding:10px 14px;font-size:14px;}
      .ai-panel-hdr button{font-size:18px;}
      .ai-panel-body{padding:12px;font-size:13px;line-height:1.6;}
      .ai-panel-body .ai-msg{padding:8px 10px;margin-bottom:10px;}
      .ai-panel-body .ai-msg.assistant h3{font-size:13px;margin:8px 0 2px;}
      .ai-panel-body .ai-msg.assistant code{font-size:11px;}
      .ai-panel-body .ai-welcome{margin-top:20px;font-size:13px;line-height:1.6;}
      .ai-panel-body .ai-loading{font-size:13px;padding:8px;}

      body.ai-panel-open{margin-right:0 !important;}
      .ai-resize{display:none !important;}

      .ai-table-wrap table{font-size:11px;}
      .ai-table-wrap th{padding:6px 8px;}
      .ai-table-wrap td{padding:4px 8px;}
      .ai-table-wrap .ai-table-container{max-height:250px;}
      .ai-excel-btns button{padding:5px 10px;font-size:11px;}
    }
  `;
  document.head.appendChild(style);

  /* ── Bottom Bar ── */
  const bar = document.createElement("div");
  bar.className = "ai-chat-bar";
  bar.id = "ai-chat-bar";
  bar.innerHTML = `
    <div class="ai-chat-row">
      <input type="text" id="ai-q-input" placeholder="${PLACEHOLDER}"
             onkeydown="if(event.key==='Enter')window._aiAsk()">
      <button onclick="window._aiAsk()">\u9001\u4FE1</button>
    </div>
    <div class="ai-footer">${FOOTER_TEXT}</div>
  `;
  document.body.appendChild(bar);

  /* ── Right Panel ── */
  const panel = document.createElement("div");
  panel.className = "ai-panel";
  panel.id = "ai-panel";
  panel.innerHTML = `
    <div class="ai-panel-hdr">
      <span>${TITLE}</span>
      <button onclick="window._aiClose()">\u2715</button>
    </div>
    <div class="ai-panel-body" id="ai-panel-body">
      <div class="ai-welcome">
        \u90E8\u6750\u30FB\u8CC7\u6750\u306B\u95A2\u3059\u308B\u8CEA\u554F\u3092<br>\u4E0B\u306E\u5165\u529B\u6B04\u304B\u3089\u3069\u3046\u305E\u3002
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  /* ── Resize Handle ── */
  const resize = document.createElement("div");
  resize.className = "ai-resize";
  document.body.appendChild(resize);

  /* ── State ── */
  let history = [];
  let isOpen = false;
  let tableCounter = 0;

  /* ── Functions ── */
  function openPanel() {
    if (isOpen) return;
    isOpen = true;
    panel.classList.add("vis");
    document.body.classList.add("ai-panel-open");
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove("vis");
    document.body.classList.remove("ai-panel-open");
  }

  /* ── Parse Markdown Table ── */
  function parseMdTable(tableStr) {
    const lines = tableStr.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) return null;
    const parseRow = (line) => line.split("|").map(c => c.trim()).filter(c => c !== "");
    const headers = parseRow(lines[0]);
    // skip separator line (line with ---)
    const startIdx = lines[1].replace(/[|\s\-:]/g, "") === "" ? 2 : 1;
    const rows = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cells = parseRow(lines[i]);
      if (cells.length > 0 && !cells.every(c => /^[\-:]+$/.test(c))) {
        rows.push(cells);
      }
    }
    return rows.length > 0 ? { headers, rows } : null;
  }

  /* ── Build HTML Table ── */
  function buildTableHtml(tableData, id) {
    let html = `<div class="ai-table-wrap" id="tw-${id}">`;
    html += `<div class="ai-table-container"><table>`;
    html += "<thead><tr>" + tableData.headers.map(h => `<th>${h}</th>`).join("") + "</tr></thead>";
    html += "<tbody>";
    tableData.rows.forEach(row => {
      html += "<tr>" + row.map(c => `<td>${c}</td>`).join("") + "</tr>";
    });
    html += "</tbody></table></div></div>";

    // Excel buttons
    html += `<div class="ai-excel-btns">`;
    html += `<button onclick="window._aiToggleTable('tw-${id}')" title="\u30C6\u30FC\u30D6\u30EB\u8868\u793A/\u975E\u8868\u793A">`;
    html += `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>`;
    html += `\u30C6\u30FC\u30D6\u30EB\u8868\u793A</button>`;
    html += `<button onclick="window._aiDownloadExcel('tw-${id}')" title="Excel\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9">`;
    html += `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`;
    html += `Excel \u30C0\u30A6\u30F3\u30ED\u30FC\u30C9</button>`;
    html += `</div>`;
    return html;
  }

  /* ── Toggle Table Visibility ── */
  window._aiToggleTable = function (id) {
    const tw = document.getElementById(id);
    if (!tw) return;
    const btn = tw.nextElementSibling?.querySelector("button");
    if (tw.style.display === "none") {
      tw.style.display = "";
      if (btn) btn.innerHTML = btn.innerHTML.replace("\u30C6\u30FC\u30D6\u30EB\u8868\u793A", "\u30C6\u30FC\u30D6\u30EB\u8868\u793A");
    } else {
      tw.style.display = "none";
      if (btn) btn.innerHTML = btn.innerHTML.replace("\u30C6\u30FC\u30D6\u30EB\u8868\u793A", "\u30C6\u30FC\u30D6\u30EB\u518D\u8868\u793A");
    }
  };

  /* ── Download as Excel ── */
  window._aiDownloadExcel = function (id) {
    const tw = document.getElementById(id);
    if (!tw || !window.XLSX) {
      alert("Excel\u30E9\u30A4\u30D6\u30E9\u30EA\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D\u3067\u3059\u3002\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002");
      return;
    }
    // Get table element (could be hidden)
    const origDisplay = tw.style.display;
    tw.style.display = "";
    const table = tw.querySelector("table");
    if (!table) { tw.style.display = origDisplay; return; }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);

    // Auto column width
    const cols = [];
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let c = range.s.c; c <= range.e.c; c++) {
      let maxW = 8;
      for (let r = range.s.r; r <= range.e.r; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v) {
          const len = String(cell.v).length;
          if (len > maxW) maxW = Math.min(len + 2, 40);
        }
      }
      cols.push({ wch: maxW });
    }
    ws["!cols"] = cols;

    XLSX.utils.book_append_sheet(wb, ws, "AI\u691C\u7D22\u7D50\u679C");
    const now = new Date();
    const ts = now.getFullYear() + ("0"+(now.getMonth()+1)).slice(-2) + ("0"+now.getDate()).slice(-2) + "_" + ("0"+now.getHours()).slice(-2) + ("0"+now.getMinutes()).slice(-2);
    XLSX.writeFile(wb, "AI_result_" + ts + ".xlsx");
    tw.style.display = origDisplay;
  };

  /* ── Render Markdown with Table Detection ── */
  function renderMd(text) {
    // First, extract markdown tables and replace with placeholders
    const tables = [];
    const tableRegex = /((?:^\|.+\|[ \t]*\n){2,})/gm;
    let processed = text.replace(tableRegex, (match) => {
      const parsed = parseMdTable(match);
      if (parsed) {
        const id = ++tableCounter;
        tables.push({ id, data: parsed });
        return `\n%%TABLE_${id}%%\n`;
      }
      return match;
    });

    // Standard markdown rendering
    processed = processed
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
      .replace(/\n{2,}/g, "<br><br>")
      .replace(/\n/g, "<br>");

    // Replace placeholders with actual table HTML
    tables.forEach(t => {
      processed = processed.replace(`%%TABLE_${t.id}%%`, buildTableHtml(t.data, t.id));
    });

    return processed;
  }

  function addMsg(role, text) {
    const body = document.getElementById("ai-panel-body");
    const welcome = body.querySelector(".ai-welcome");
    if (welcome) welcome.remove();

    const div = document.createElement("div");
    div.className = "ai-msg " + role;
    div.innerHTML = role === "user" ? text : renderMd(text);
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  window._aiAsk = async function () {
    const input = document.getElementById("ai-q-input");
    const msg = input.value.trim();
    if (!msg) return;
    input.value = "";

    openPanel();
    addMsg("user", msg);
    history.push({ role: "user", content: msg });

    const body = document.getElementById("ai-panel-body");
    const loader = document.createElement("div");
    loader.className = "ai-loading";
    loader.textContent = "\u2026\u56DE\u7B54\u3092\u751F\u6210\u4E2D";
    body.appendChild(loader);
    body.scrollTop = body.scrollHeight;

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: history.slice(-10) }),
      });
      const ct = res.headers.get("content-type") || "";
      let answer = "";

      if (ct.includes("text/event-stream")) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop();
          for (const ln of lines) {
            if (!ln.startsWith("data: ")) continue;
            const payload = ln.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const ev = JSON.parse(payload);
              if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
                answer += ev.delta.text;
              }
            } catch (e) {}
          }
        }
      } else {
        const data = await res.json();
        answer = data.response || data.error || "\u5FDC\u7B54\u306A\u3057";
      }

      loader.remove();
      addMsg("assistant", answer);
      history.push({ role: "assistant", content: answer });
    } catch (err) {
      loader.remove();
      addMsg("assistant", "\u26A0\uFE0F \u63A5\u7D9A\u30A8\u30E9\u30FC: " + err.message);
    }
  };

  window._aiClose = closePanel;

  /* ── Resize Drag ── */
  let dragging = false;
  resize.addEventListener("mousedown", (e) => { dragging = true; e.preventDefault(); });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const w = Math.max(280, window.innerWidth - e.clientX);
    panel.style.width = w + "px";
    resize.style.right = w + "px";
    document.body.style.marginRight = w + "px";
  });
  document.addEventListener("mouseup", () => { dragging = false; });
})();
