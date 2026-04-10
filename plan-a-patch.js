/**
 * 방법 A 패치 스크립트 — index.html용
 * A-1: 원본 aiSendBtn → 스트리밍 API 연결
 * A-3: .ai-response-header 블루 톤 변경
 */
(function () {
  "use strict";

  // ===== A-3: 스타일 패치 (오렌지 → 블루 + 다크 배경) =====
  const patchStyle = document.createElement("style");
  patchStyle.textContent = `
    .ai-response-header { background: #3b82f6 !important; }
    #aiPanel { background: #0f172a !important; border: 1px solid #334155 !important; border-radius: 8px !important; }
    #aiResults { background: #0f172a !important; color: #e2e8f0 !important; padding: 8px !important; }
  `;
  document.head.appendChild(patchStyle);

  // ===== A-1: 원본 AI 핸들러를 스트리밍 API에 연결 =====
  const aiSendBtn = document.getElementById("aiSendBtn");
  const aiInput = document.getElementById("aiInput");
  if (!aiSendBtn || !aiInput) return;

  // 기존 이벤트 리스너 제거 (클론 교체 방식)
  const newBtn = aiSendBtn.cloneNode(true);
  aiSendBtn.parentNode.replaceChild(newBtn, aiSendBtn);

  const newInput = aiInput.cloneNode(true);
  aiInput.parentNode.replaceChild(newInput, aiInput);

  // 새 핸들러 등록
  newBtn.addEventListener("click", handleAiSearch);
  newInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleAiSearch();
  });

  async function handleAiSearch() {
    const input = document.getElementById("aiInput");
    const msg = input.value.trim();
    if (!msg) return;

    const panel = document.getElementById("aiPanel");
    const results = document.getElementById("aiResults");
    panel.style.display = "block";
    results.innerHTML =
      '<div style="color:#94a3b8;padding:12px;text-align:center;">…回答を生成中</div>';

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: [] }),
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
              if (
                ev.type === "content_block_delta" &&
                ev.delta?.type === "text_delta"
              ) {
                answer += ev.delta.text;
                results.innerHTML =
                  '<div style="color:#e2e8f0;padding:8px;line-height:1.7;font-size:13px;">' +
                  answer
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(
                      /\*\*(.+?)\*\*/g,
                      '<strong style="color:#60a5fa">$1</strong>'
                    )
                    .replace(
                      /`([^`]+)`/g,
                      '<code style="background:#334155;padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>'
                    )
                    .replace(
                      /^### (.+)$/gm,
                      '<h3 style="color:#60a5fa;font-size:14px;margin:10px 0 4px;">$1</h3>'
                    )
                    .replace(
                      /^## (.+)$/gm,
                      '<h3 style="color:#60a5fa;font-size:14px;margin:10px 0 4px;">$1</h3>'
                    )
                    .replace(/\n/g, "<br>") +
                  "</div>";
                results.scrollTop = results.scrollHeight;
              }
            } catch (e) {}
          }
        }
      } else {
        const data = await res.json();
        answer = data.response || data.error || "応答なし";
        results.innerHTML =
          '<div style="color:#e2e8f0;padding:8px;">' + answer + "</div>";
      }

      if (!answer)
        results.innerHTML =
          '<div style="color:#f97316;padding:8px;">応答を取得できませんでした。</div>';
    } catch (e) {
      results.innerHTML =
        '<div style="color:#f97316;padding:8px;">接続エラー: ' +
        e.message +
        "</div>";
    }
  }
})();
