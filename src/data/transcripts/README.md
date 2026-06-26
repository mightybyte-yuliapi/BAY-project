# Call transcripts — tone source material

These are real first-touch sales-qualification calls (Aaron, COO, talking to
inbound leads). They are the source of the agent's **tone and cadence**.

## How they feed the agent

The transcripts are **not** injected wholesale into the prompt — that would be
~15-20K tokens on every call. Instead, the highest-signal exchanges are curated
into `TONE_EXAMPLES` in `src/agent/knowledge.ts`, which is composed into the
system prompt as few-shot examples. That's the standard way to shape a model's
voice: a tight set of representative exchanges, always present, cheap per call.

```
*.rtf  (original, from the team)
  └─ textutil → *.txt  (plain text, readable by tools/agents)
        └─ curated excerpts → TONE_EXAMPLES (src/agent/knowledge.ts)
              └─ composed into the system prompt (src/agent/config.ts)
```

## Updating

When the team sends new/updated calls:
1. Drop the `.rtf` files in `_source_rtf/`.
2. Convert: `textutil -convert txt -output transcriptN.txt _source_rtf/TranscriptN.rtf`
3. Re-curate the best exchanges into `TONE_EXAMPLES`. Keep it tight (≈10-14 short
   excerpts) and preserve Aaron's actual wording — his phrasing is the point.

The full transcripts stay here as reference; only the curated subset ships in the
prompt.
