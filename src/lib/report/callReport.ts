// src/lib/report/callReport.ts
//
// Types + email rendering for the post-call briefing. Every call — whether the
// agent wrapped it up or the prospect abandoned it — produces one of these and
// emails it with three blocks: AI summary, AI recommendations, raw transcript.

export type TranscriptLine = { role: "user" | "agent"; text: string };

// How the call ended, as reported by the client.
export type EndReason = "completed" | "abandoned";

// Triage flag shown in the subject line.
export type CallFlag = "strong" | "weak" | "suspicious" | "unfinished";

// What the analysis model returns (see prompts.ts OUTPUT CONTRACT).
export type CallAnalysis = {
  flag: CallFlag;
  title: string;
  summary: string;
  recommendations: string;
};

const FLAG_META: Record<CallFlag, { emoji: string; label: string; color: string }> = {
  strong: { emoji: "✅", label: "STRONG LEAD", color: "#15803d" },
  weak: { emoji: "🟡", label: "WEAK LEAD", color: "#b45309" },
  suspicious: { emoji: "🚩", label: "SUSPICIOUS ACTIVITY", color: "#b91c1c" },
  unfinished: { emoji: "⚠️", label: "CALL UNFINISHED", color: "#6b7280" },
};

export function callSubject(a: CallAnalysis): string {
  const m = FLAG_META[a.flag];
  return `${m.emoji} ${m.label} — ${a.title || "AppMakers call"}`;
}

// Render the transcript as readable "Lead:" / "Agent:" lines.
function transcriptLines(t: TranscriptLine[]): string[] {
  return t.map((l) => `${l.role === "user" ? "Lead" : "Agent"}: ${l.text}`);
}

export function callText(a: CallAnalysis, transcript: TranscriptLine[]): string {
  const m = FLAG_META[a.flag];
  return [
    `${m.emoji} ${m.label}`,
    a.title,
    ``,
    `── SUMMARY ──`,
    a.summary,
    ``,
    `── RECOMMENDATIONS ──`,
    a.recommendations,
    ``,
    `── RAW TRANSCRIPT ──`,
    transcript.length ? transcriptLines(transcript).join("\n") : "(no transcript captured)",
  ].join("\n");
}

export function callHtml(a: CallAnalysis, transcript: TranscriptLine[]): string {
  const m = FLAG_META[a.flag];
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");

  const section = (title: string, body: string) =>
    `<h3 style="margin:20px 0 4px;font:600 13px/1.4 -apple-system,Segoe UI,sans-serif;color:#111;text-transform:uppercase;letter-spacing:.04em">${title}</h3>
     <div style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;color:#222">${body}</div>`;

  const transcriptHtml = transcript.length
    ? transcript
        .map(
          (l) =>
            `<div style="margin:2px 0"><b style="color:${
              l.role === "user" ? "#111" : "#2563eb"
            }">${l.role === "user" ? "Lead" : "Agent"}:</b> ${esc(l.text)}</div>`,
        )
        .join("")
    : "<i>(no transcript captured)</i>";

  return `<div style="max-width:640px">
    <div style="display:inline-block;padding:6px 12px;border-radius:6px;background:${m.color};color:#fff;font:700 13px -apple-system,Segoe UI,sans-serif;letter-spacing:.03em">${m.emoji} ${m.label}</div>
    <div style="margin-top:8px;font:600 16px -apple-system,Segoe UI,sans-serif;color:#111">${esc(a.title)}</div>
    ${section("Summary", esc(a.summary))}
    ${section("Recommendations", esc(a.recommendations))}
    ${section("Raw transcript", `<div style="font:13px/1.5 ui-monospace,Menlo,monospace;color:#333;background:#f6f6f6;border-radius:8px;padding:12px">${transcriptHtml}</div>`)}
  </div>`;
}
