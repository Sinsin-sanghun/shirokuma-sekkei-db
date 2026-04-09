/**
 * AI Chatbot Widget - shirokuma-sekkei-db
 * PC: Bottom input bar + Right side panel
 * Mobile: Compact fixed bottom bar (always visible) + Fullscreen panel
 * + Excel table view & download feature
 */
(function () {
  if (document.getElementById("ai-chat-bar")) return;

  /* ââ Config ââ */
  const API = "/api/chat";
  const TITLE = "\u{1F916} AIé¨æã¢ã·ã¹ã¿ã³ã";
  const PLACEHOLDER = "AIã«è³ªåï¼ä¾: ããããã®é¨æã¯ï¼ å¨åº«ã®è©³ç´°ã¯ï¼ï¼";
  const FOOTER_TEXT = "Claude AI ãDBãæ¤ç´¢ãã¦åç­ãã¾ãã";
  const ACCENT = "#3b82f6";
  const ACCENT_HOVER = "#2563eb";
  const ACCENT_LIGHT = "#60a5fa";
  const ACCENT_PALE = "#93c5fd";

  /* ââ Load SheetJS for Excel export ââ */
  if (!window.XLSX) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    document.head.appendChild(s);
  }

  /* ââ Styles ââ */
  const style = document.createElement("style");
  style.textContent = `
    /* ===== Bottom Bar ===== */
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

    /* ===== Right Panel ===== */
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

    /* ===== Resize handle ===== */
    .ai-resize{position:fixed;top:0;bottom:0;width:5px;right:400px;z-index:9999;
      cursor:col-resize;background:transparent;display:none;}
    .ai-panel.vis~.ai-resize{display:block;}
    .ai-resize:hover{background:#334155;}

    /* Push content when panel open (PC) */
    body.ai-panel-open{margin-right:400px;transition:margin .3s ease;}
    /* Prevent content hidden behind bar (PC) */
    body{padding-bottom:70px !important;}

    /* ===== Excel Table Styles ===== */
    .ai-table-wrap{overflow-x:auto;margin:10px 0;border-radius:6px;border:1px solid #334155;}
    .ai-table-wrap table{width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap;}
    .ai-table-wrap th{background:#0f172a;color:${ACCENT_LIGHT};padding:8px 10px;
      text-align:left;border-bottom:2px solid ${ACCENT};font-weight:600;position:sticky;top:0;}
    .ai-table-wrap td{padding:6px 10px;border-bottom:1px solid #334155;color:#e2e8f0;}
    .ai-table-wrap tr:hover td{background:#334155;}
    .ai-table-wrap .ai-table-container{max-height:300px;overflow-y:auto;}
    .ai-excel-btns{display:flex;gap:6px;margin:8px 0 4px;flex-wrap:wrap;}
    .ai-excel-btns button{padding:6px 12px;border-radius:6px;border:1px solid #334155;
      background:#1e293b;color:#e2e8f0;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;}
    .ai-excel-btns button:hover{background:#334155;border-color:${ACCENT};}
    .ai-excel-btns button svg{width:14px;height:14px;}

    /* ===== Mobile: compact bar, always visible ===== */
    @media(max-width:768px){
      /* Compact bottom bar - 1ì¤, footer ì¨ê¹ */
      .ai-chat-bar{padding:6px 8px;gap:0;}
      .ai-chat-row{gap:6px;}
      .ai-chat-bar input{padding:8px 10px;font-size:13px;border-radius:6px;}
      .ai-chat-bar button{padding:8px 12px;font-size:13px;border-radius:6px;}
      .ai-chat-bar .ai-footer{display:none;}

      /* íì´ì§ ì½íì¸ ê° ê²ìë°ì ì ê°ë ¤ì§ê² */
      body{padding-bottom:52px !important;}

      /* Panel = fullscreen */
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

  /* ââ Bottom Bar ââ */
  const bar = document.createElement("div");
  bar.className = "ai-chat-bar";
  bar.id = "ai-chat-bar";
  bar.innerHTML = `
    <div class="ai-chat-row">
      <input type="text" id="ai-q-input" placeholder="${PLACEHOLDER}"
             onkeydown="if(event.key==='Enter')window._aiAsk()">
      <button onclick="window._aiAsk()">éä¿¡</button>
    </div>
    <div class="ai-footer">${FOOTER_TEXT}</div>
  `;
  document.body.appendChild(bar);

  /* ââ Right Panel ââ */
  const panel = document.createElement("div");
  panel.className = "ai-panel";
  panel.id = "ai-panel";
  panel.innerHTML = `
    <div class="ai-panel-hdr">
      <span>${TITLE}</span>
      <button onclick="window._aiClose()">â</button>
    </div>
    <div class="ai-panel-body" id="ai-panel-body">
      <div class="ai-welcome">
        é¨æã»è³æã«é¢ããè³ªåã<br>ä¸ã®å¥åæ¬ããã©ããã
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  /* ââ Resize Handle ââ */
  const resize = document.createElement("div");
  resize.className = "ai-resize";
  document.body.appendChild(resize);

  /* ââ State ââ */
  let history = [];
  let isOpen = false;
  let tableCounter = 0;

  /* ââ Functions ââ */
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

  /* ââ Parse Markdown Table ââ */
  function parseMdTable(tableStr) {
    const lines = tableStr.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) return null;
    const parseRow = (line) => line.split("|").map(c => c.trim()).filter(c => c !== "");
    const headers = parseRow(lines[0]);
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

  /* ââ Build HTML Table ââ */
  function buildTableHtml(tableData, id) {
    let html = `<div class="ai-table-wrap" id="tw-${id}">`;
    html += `<div class="ai-table-container"><table>`;
    html += "<thead><tr>" + tableData.headers.map(h => `<th>${h}</th>`).join("") + "</tr></thead>";
    html += "<tbody>";
    tableData.rows.forEach(row => {
      html += "<tr>" + row.map(c => `<td>${c}</td>`).join("") + "</tr>";
    });
    html += "</tbody></table></div></div>";
    html += `<div class="ai-excel-btns">`;
    html += `<button onclick="window._aiToggleTable('tw-${id}')" title="ãã¼ãã«è¡¨ç¤º/éè¡¨ç¤º">`;
    html += `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>`;
    html += `ãã¼ãã«è¡¨ç¤º</button>`;
    html += `<button onclick="window._aiDownloadExcel('tw-${id}')" title="Excelãã¦ã³ã­ã¼ã">`;
    html += `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`;
    html += `Excel ãã¦ã³ã­ã¼ã</button>`;
    html += `</div>`;
    return html;
  }

  /* ââ Toggle Table Visibility ââ */
  window._aiToggleTable = function (id) {
    const tw = document.getElementById(id);
    if (!tw) return;
    const btn = tw.nextElementSibling?.querySelector("button");
    if (tw.style.display === "none") {
      tw.style.display = "";
      if (btn) btn.innerHTML = btn.innerHTML.replace("ãã¼ãã«åè¡¨ç¤º", "ãã¼ãã«è¡¨ç¤º");
    } else {
      tw.style.display = "none";
      if (btn) btn.innerHTML = btn.innerHTML.replace("ãã¼ãã«è¡¨ç¤º", "ãã¼ãã«åè¡¨ç¤º");
    }
  };

  /* ââ Download as Excel ââ */
  window._aiDownloadExcel = function (id) {
    const tw = document.getElementById(id);
    if (!tw || !window.XLSX) {
      alert("Excelã©ã¤ãã©ãªãèª­ã¿è¾¼ã¿ä¸­ã§ããããä¸åº¦ãè©¦ããã ããã");
      return;
    }
    const origDisplay = tw.style.display;
    tw.style.display = "";
    const table = tw.querySelector("table");
    if (!table) { tw.style.display = origDisplay; return; }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
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
    XLSX.utils.book_append_sheet(wb, ws, "AIæ¤ç´¢çµæ");
    const now = new Date();
    const ts = now.getFullYear() + ("0"+(now.getMonth()+1)).slice(-2) + ("0"+now.getDate()).slice(-2) + "_" + ("0"+now.getHours()).slice(-2) + ("0"+now.getMinutes()).slice(-2);
    XLSX.writeFile(wb, "AI_result_" + ts + ".xlsx");
    tw.style.display = origDisplay;
  };

  /* ââ Render Markdown with Table Detection ââ */
  function renderMd(text) {
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
    processed = processed
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
      .replace(/\n{2,}/g, "<br><br>")
      .replace(/\n/g, "<br>");
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
    loader.textContent = "â¦åç­ãçæä¸­";
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
        answer = data.response || data.error || "å¿ç­ãªã";
      }

      loader.remove();
      addMsg("assistant", answer);
      history.push({ role: "assistant", content: answer });
    } catch (err) {
      loader.remove();
      addMsg("assistant", "â ï¸ æ¥ç¶ã¨ã©ã¼: " + err.message);
    }
  };

  window._aiClose = closePanel;

  /* ââ Resize Drag (PC only) ââ */
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
