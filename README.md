# Bhashya AI

Bhashya AI turns short idea prompts and long-form source content into ready-to-publish social reels, short videos, and structured scripts. It focuses on rapid content generation with configurable output settings so creators and  teams can go from idea → script → rendered media in minutes.

## What Bhashya AI Does
- Converts an idea or message into a structured script suitable for short-form video.
- Generates finished reels/videos automatically (editing, styling, and formatting handled by the system).
- Provides a preview gallery of inspired creations and example prompts for quick iteration.

## Key UI Concepts 
- Describe your idea or message in the prompt box (up to ~500 characters in the UI).
- Provide a delivery email so we can send finished outputs when generation completes.
- Estimated generation time is shown in the UI (typically a few minutes depending on queue and settings).

## Common Inputs / Settings
These map to form fields available in the web UI and the API payloads the app accepts.

- `prompt` / `idea` (string, required): Short description of the reel or message to generate.
- `deliveryEmail` (string, required in UI): Email to receive the finished asset link.
- `orientation` (string): `vertical` or `horizontal` (default: vertical).
- `resolution` (string): e.g., `360p`, `sd`, `hd`.
- `contentCategory` (string): e.g., `AUDIO`, `MYTHOLOGICAL`, `GENERAL` — used to influence style and templates.
- `audioQuality` (string): `neural`, `low-ai`, `high-ai` (affects TTS/render quality).
- `duration` (string|int): desired clip length (e.g., `1 Min`, `2 Min`).
- `outputLanguage` (string): language for text and TTS (e.g., `English`, `Hindi`).
- `settings` (object): miscellaneous toggles (premium access, unmute/auto-play options, gallery selection).

Example UI payload (conceptual):

```
{
  "prompt": "Top 5 places to visit in Montana in summer",
  "deliveryEmail": "team@example.com",
  "orientation": "vertical",
  "resolution": "360p",
  "contentCategory": "GENERAL",
  "audioQuality": "neural",
  "duration": "1 Min",
  "outputLanguage": "English"
}
```

## UX Notes
- The page shows a live preview and an estimated generation time (e.g., "2–4 minutes").
- Prompts and example templates are surfaced under "Inspired Creations" for quick reuse.
- The UI requires a valid email to send the output link when generation finishes.

## Integration Points
- Web UI: main workflow for creators — enter prompt, choose settings, submit, then wait for email + preview.
- API / Proxy: routes such as `/api/generate` and `/api/generate/:id` accept generation requests and the frontend subscribes to Firestore `generations/<id>` documents for stepwise progress.

## Operational Notes
- Generation can take a few minutes; include a delivery email to receive results asynchronously.
- For premium features and higher-quality audio, enable the appropriate `settings` flags in the UI or API request.

---

If you want, I can pull more text examples from `http://127.0.0.1:5002/` and paste them verbatim into this README, or add a short developer setup section (emulator and deploy steps).
# Bhashya AI —  Summary

Bhashya AI transforms long-form source content into concise, -ready summaries and shareable media. It helps teams quickly extract decisions, action items, and highlights from meetings, support threads, documents, and web content.

## Key  Use Cases
- Meeting summaries and prioritized action items for faster follow-up.
- Customer support briefings that convert long tickets or call transcripts into concise handoffs.
- Executive and product briefs that surface decisions, risks, and blockers.
- Content repurposing: short highlights or audio from long reports for internal communications.

## Primary Outputs
- Short textual summaries (paragraph or bullet list).
- Structured action items with assignee and deadlines (when present in source).
- Optional audio (TTS) renders and lightweight slide-style exports for sharing.

## Required / Recommended Inputs
Provide as JSON, form fields, or via the UI. The following keys are supported and recommended for  workflows:

- `sourceText` (string) — Required. The raw content to summarize (transcript, article, or document).
- `sourceType` (string) — Optional. One of: `transcript`, `article`, `document`, `webpage`. Guides summarization style.
- `language` (string) — Optional. BCP-47 tag (e.g., `en-US`) for locale-aware processing and TTS.
- `summaryLength` (string|int) — Optional. `short`, `concise`, `detailed` or an explicit word limit.
- `focusAreas` (array[string]) — Optional. Topics/keywords to prioritize (e.g., `billing`, `release`).
- `outputFormats` (array[string]) — Optional. Any of `text`, `bullet-list`, `audio`, `slides`. Defaults to `text`.
- `voiceOptions` (object) — Optional. TTS settings: `voice`, `speed`, `quality` when `audio` requested.
- `metadata` (object) — Optional.  metadata such as `meetingId`, `ticketId`, `project`, `timestamp` for traceability.
- `token` (string) — Optional. Frontend-only token used to pre-fill or authorize the UI; not required for server-side integrations unless configured.

### Minimal example payload

```
{
  "sourceText": "The team agreed to delay feature X and prioritize bug fixes for release...",
  "sourceType": "transcript",
  "language": "en-US",
  "summaryLength": "concise",
  "outputFormats": ["text", "audio"],
  "metadata": {"meetingId": "m-12345", "project": "alpha"}
}
```

## Practical Notes for  Users
- Security: Do not put highly sensitive credentials in the `token` URL parameter. Use secure, short-lived tokens.
- Traceability: Include `metadata` such as `meetingId` or `ticketId` to map outputs back to source systems.
- Human review: For regulatory or high-stakes content, route generated summaries through a human reviewer before distribution.

If you want this content merged into the main `README.md`, I can replace that file now or append this section — tell me which you prefer.