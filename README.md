# VoC Intelligence Agent

An agentic AI system that collects public customer opinions (Trustpilot, Opineo, App Store, and CSV/JSON imports) about a selected company and its competitors, classifies sentiment and topics, clusters themes in embedding space, and then synthesizes a business report with charts and a prioritized list of action items. The entire project fits **exclusively within free tiers** (Cloudflare Workers + D1 + Vectorize + Workers AI + R2 + Pages, Gemini 2.5 Flash Lite, Brave Search) — with no paid services.

- **Durable Object as a custom workflow engine**. Cloudflare Workflows are paid, so I built a replacement on DO using SQLite storage + an alarm-driven step loop. Each step is a separate invocation, so it does not hit the 30s CPU limit per request.
- **Mixed-model inference**. Workers AI (`llama-3.1-8b-instruct` + `bge-m3`) is used for sentiment classification and embeddings, while Gemini 2.5 Flash Lite handles planning, reflection, and synthesis. A per-day neuron counter falls back to Gemini when fewer than 500 neurons remain.
- **Agentic loop with reflection**: `plan → collect → classify → reflect → [collect ↻] → synthesize`. After the first round, Gemini decides whether more data needs to be fetched (maximum 2 cycles). The agent’s reasoning is shown to the user in the UI (“Agent thinks aloud”).
- **Evidence-grounded action items**. Every quote in the report is validated with a substring match against the reviews database in D1. Hallucinations trigger a synthesis retry with a note: “fix quote X”.
- **Vectorize semantic clustering** — `bge-m3` embeddings (1024-dimensional, multilingual) are generated per review and upserted with metadata (`analysisId`, `sentiment`, `category`, `rating`).
- **Graceful degradation**. A quota guard returns 503 when Workers AI exceeds 80% of the daily limit. The frontend automatically switches to demo mode when the API is unavailable. If Trustpilot blocks scraping, a fail-fast guard returns a user-actionable message instead of generating an empty report.

## Architecture

```mermaid
flowchart TD
    User[Frontend Next.js] -->|POST /analyses| API[Hono Worker API]
    API -->|spawn| DO[(Durable Object<br/>AnalysisOrchestrator<br/>SQLite storage)]

    DO --> Plan[Step: plan<br/>Gemini Flash Lite]
    Plan --> Scrape[Step: collect<br/>fetch + HTMLRewriter]
    Scrape --> Classify[Step: classify<br/>Workers AI llama-3.1<br/>+ bge-m3]
    Classify --> Reflect[Step: reflect<br/>Gemini Flash Lite]
    Reflect -->|isEnough=false<br/>cycle < 2| Scrape
    Reflect -->|isEnough=true| Synthesize[Step: synthesize<br/>Gemini + evidence validation]
    Synthesize --> Report[Step: report<br/>self-contained HTML]

    Classify --> D1[(D1: reviews / events)]
    Classify --> VEC[(Vectorize: 1024-dim embeddings)]
    Scrape --> Cache[(D1 cache 24h)]
    Synthesize --> D1
    Report --> R2[(R2: report HTML cache)]

    API -->|GET /analyses/:id/events| SSE{{SSE stream}}
    API -->|GET /report.html| R2