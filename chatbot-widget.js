/**
 * AI Chatbot Widget - shirokuma-sekkei-db
 * Bottom input bar + Right side panel design
 */
(function () {
  if (document.getElementById("ai-chat-bar")) return;

  /* ── Config ── */
  const API = "/api/chat";
  const TITLE = "\u{1F916} AI\u90E8\u6750\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8";
  const PLACEHOLDER = "AI\u306B\u8CEA\u554F\uFF08\u4F8B: \u304A\u3059\u3059\u3081\u306E\u90E8\u6750\u306F\uFF1F \u5728\u5EAB\u306E\u8A73\u7D30\u306F\uFF1F\uFF09";
  const FOOTER_TEXT = "Claude AI \u304CDB\u3092\u691C\u7D22\u3057\u3066\u56DE\u7B54\u3057\u307E\u3059\u3002";

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
    .ai-chat-bar input:focus{border-color:#60a5fa;}
    .ai-chat-bar input::placeholder{color:#94a3b8;}
    .ai-chat-bar button{padding:10px 20px;border-radius:8px;border:none;
      background:#3b82f6;color:#fff;font-size:14px;cursor:pointer;white-space:nowrap;}
    .ai-chat-bar button:hover{background:#2563eb;}
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
    .ai-panel-body .ai-msg.assistant h3{color:#60a5fa;font-size:14px;margin:12px 0 4px;}
    .ai-panel-body .ai-msg.assistant ul{margin:4px 0 4px 18px;}
    .ai-panel-body .ai-msg.assistant li{margin:2px 0;}
    .ai-panel-body .ai-msg.assistant code{background:#334155;padding:1px 5px;border-radius:3px;font-size:13px;}
    .ai-panel-body .ai-msg.assistant strong{color:#93c5fd;}
    .ai-panel-body .ai-loading{color:#94a3b8;padding:12px;text-align:center;}

    /* Resize handle */
    .ai-resize{position:fixed;top:0;bottom:0;width:5px;right:400px;z-index:9999;
      cursor:col-resize;background:transparent;display:none;}
    .ai-panel.vis~.ai-resize{display:block;}
    .ai-resize:hover{background:#334155;}

    /* Push content when panel open */
    body.ai-panel-open{margin-right:400px;transition:margin .3s ease;}
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

  function renderMd(text) {
    return text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
      .replace(/\n{2,}/g, "<br><br>")
      .replace(/\n/g, "<br>");
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
