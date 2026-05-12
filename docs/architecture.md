# Architecture

This is the detailed companion to the architecture overview in the project [README](../README.md). It shows the full pipeline from the three source PDFs in `files/` through the build-time extractor, the committed `data/*` artifacts, the runtime tools, the agent loop, the SSE streaming boundary, and the React frontend.

```mermaid
flowchart LR
  classDef src fill:#fef3c7,stroke:#b45309,color:#111
  classDef ext fill:#e0e7ff,stroke:#3730a3,color:#111
  classDef data fill:#dcfce7,stroke:#15803d,color:#111
  classDef tool fill:#fae8ff,stroke:#86198f,color:#111
  classDef agent fill:#ffe4e6,stroke:#9f1239,color:#111
  classDef stream fill:#e2e8f0,stroke:#334155,color:#111
  classDef ui fill:#dbeafe,stroke:#1d4ed8,color:#111

  subgraph S["Source PDFs (files/)"]
    direction TB
    OM["owner-manual.pdf<br/>48 pages"]
    QS["quick-start-guide.pdf<br/>2 pages"]
    SC["selection-chart.pdf<br/>1 page"]
  end
  class OM,QS,SC src

  subgraph EX["Extraction (scripts/, build-time only)"]
    direction TB
    EXP["extract-pages.ts<br/>(pdf-to-img + pdfjs)"]
    EXR["extract-regions.ts<br/>(sharp crops)"]
    HAND["hand-authored<br/>JSON tables"]
  end
  class EXP,EXR,HAND ext

  subgraph D["Committed knowledge (data/)"]
    direction TB
    PAGES["pages/owner-manual-NNN.png + .txt<br/>+ quick-start + selection-chart"]
    INDEX["index.json<br/>per-page text + section index"]
    DC["duty_cycle.json"]
    POL["polarity.json"]
    SET["settings.json"]
    TROUBLE["troubleshooting.json"]
    PARTS["parts.json"]
    REG["regions.json<br/>+ regions/*.png"]
  end
  class PAGES,INDEX,DC,POL,SET,TROUBLE,PARTS,REG data

  subgraph T["Runtime tools (src/tools/, server-only)"]
    direction TB
    LD["lookup_duty_cycle"]
    LP["lookup_polarity"]
    LS["lookup_settings"]
    SM["search_manual"]
    GR["get_region"]
    GPI["get_page_image"]
    RDC["render_duty_cycle_artifact"]
    RPOL["render_polarity_artifact"]
    RSET["render_settings_artifact"]
    RTR["render_troubleshoot_artifact"]
  end
  class LD,LP,LS,SM,GR,GPI,RDC,RPOL,RSET,RTR tool

  subgraph A["Agent (src/agent/)"]
    direction TB
    PROMPT["system-prompt.ts<br/>policy + tool sequencing"]
    LOOP["runtime.ts<br/>Anthropic Messages SDK<br/>tool loop, citation emitter"]
  end
  class PROMPT,LOOP agent

  subgraph SSE["Streaming boundary (src/app/api/chat + src/streaming/)"]
    direction TB
    ROUTE["/api/chat/route.ts<br/>POST, SSE response, rate-limit, cache"]
    TYPES["streaming/types.ts<br/>StreamEvent + ArtifactPayload<br/>(no Anthropic imports)"]
    PARSE["streaming/parser.ts<br/>zod validation"]
    CLIENT["streaming/client.ts<br/>browser SSE reader"]
  end
  class ROUTE,TYPES,PARSE,CLIENT stream

  subgraph UI["Frontend (src/app/, src/components/)"]
    direction TB
    PAGE["app/page.tsx → ChatShell"]
    MSG["components/chat/<br/>Composer · MessageList · Citation · ToolChip · ManualViewer"]
    ART["components/artifacts/<br/>DutyCycle · Polarity · Settings · Troubleshooting"]
  end
  class PAGE,MSG,ART ui

  OM --> EXP
  QS --> EXP
  SC --> EXP
  EXP --> PAGES
  EXP --> INDEX
  PAGES --> EXR
  EXR --> REG
  HAND --> DC
  HAND --> POL
  HAND --> SET
  HAND --> TROUBLE
  HAND --> PARTS

  INDEX --> SM
  DC --> LD
  POL --> LP
  SET --> LS
  TROUBLE --> RTR
  REG --> GR
  PAGES --> GPI
  PARTS --> SM

  LD --> LOOP
  LP --> LOOP
  LS --> LOOP
  SM --> LOOP
  GR --> LOOP
  GPI --> LOOP
  RDC --> LOOP
  RPOL --> LOOP
  RSET --> LOOP
  RTR --> LOOP
  PROMPT --> LOOP

  LOOP --> ROUTE
  ROUTE -- "SSE: text_delta · tool_call_start/end · artifact · citation · error · done" --> CLIENT
  TYPES -. shared types .- PARSE
  PARSE -. validates payloads .- ROUTE
  PARSE -. validates events .- CLIENT
  CLIENT --> PAGE
  PAGE --> MSG
  PAGE --> ART
```

## Reading the diagram

1. **Source PDFs (yellow).** Three PDFs in `files/` are the only ground truth. They are checked in and treated as read-only references — the agent never re-reads a PDF at runtime.
2. **Extraction (indigo).** Build-time-only Node scripts in `scripts/`. `extract-pages.ts` renders each PDF page to a 300 DPI PNG and extracts a per-page text layer; `extract-regions.ts` re-crops named regions out of the rendered pages with `sharp`. The structured tables (`duty_cycle.json`, `polarity.json`, `settings.json`, `troubleshooting.json`, `parts.json`) are hand-authored against the manual with explicit page citations — the small corpus does not justify an LLM-extraction step.
3. **Committed knowledge (green).** Everything the agent consults at runtime lives under `data/` and is checked into git. Reviewers and Vercel deployments rely on these committed artifacts — `npm run extract` is a one-shot author-time script, not a deploy step.
4. **Runtime tools (purple).** Ten tools, server-only. Six are lookup / search / image surfaces; four are typed `render_*_artifact` tools, one per artifact kind. The strict-lookup tools (`lookup_duty_cycle`, `lookup_polarity`, `lookup_settings`) never fabricate values — out-of-range input is mapped to the nearest grounded band rather than guessed.
5. **Agent (pink).** `src/agent/runtime.ts` drives the Anthropic Messages SDK tool loop (model: `claude-sonnet-4-6`, max 6 tool loops per turn). The system prompt in `src/agent/system-prompt.ts` enforces the lookup → render pairing, citation discipline, the safety-nudge policy, and the single-question clarification rule.
6. **Streaming boundary (slate).** `src/app/api/chat/route.ts` is the only HTTP entry point. It validates the request, enforces a per-IP rate limit, reads a small response cache, then calls `streamAgentTurn` and serializes everything to Server-Sent Events. The discriminated `StreamEvent` union and `ArtifactPayload` schema live in `src/streaming/`, which imports neither the Anthropic SDK nor any runtime tool — this is the bundle-split point that keeps the agent SDK out of the browser.
7. **Frontend (blue).** A Next.js App Router page (`src/app/page.tsx`) mounts the chat shell. Artifact payloads are rendered by typed React components in `src/components/artifacts/`; the `RenderArtifact` switch matches on the `type` field of the validated payload, so the UI never receives free-form model output as code.

## Why this shape

- **Pre-extracted JSON over runtime PDF parsing.** The corpus is 51 pages across three documents. Extracting once, validating with zod, and committing the result removes an entire class of runtime failure (PDF parsing in serverless, OCR drift, retrieval latency) and makes every grounded answer deterministic.
- **Discriminated artifact union over free-form rich content.** Each artifact is a small, typed payload. The model fills in the slots; the UI owns the rendering. Model output never reaches the DOM as HTML, JS, or CSS — only as primitive props on validated payloads.
- **Single Next.js app on Vercel.** No separate backend, no extra service. `ANTHROPIC_API_KEY` is consumed only inside the Route Handler — never exposed to the browser bundle.
