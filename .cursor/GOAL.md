# Goal — Homeschool Tutoring Platform with Tennessee DMV Written Test Module

## North star

Reconfigure **Project-ECHO** into **one module inside a larger homeschool tutoring app**. The app's entry point is a **module hub** where students and parents choose what to study. **Project-ECHO** (Charlotte Mason recitation + dictation) remains a module, but the **first new module to build** is:

**Tennessee Written Driver's Test Prep** — use the official TN Driver License Manual PDF, extract the text needed for the written exam, study it on screen with a tutor character reading aloud and **word-by-word highlighting**, with **playback speed control**.

Reuse proven patterns from Project-ECHO where they fit: ElevenLabs TTS, word-highlight sync (timestamps + audio clock), API key settings, dark readable UI, patient pacing for learners.

---

## Product vision

**Audience:** Homeschool students (and parents helping them), starting with a teen preparing for the Tennessee DMV **written** knowledge test.

**Problem:** The official driver manual is long, includes non-test content, and is hard to absorb as a dense PDF. Students need a guided way to study only what matters for the written test, with read-along support for retention.

**Solution:** A modular tutoring platform where each module is a self-contained study experience. Module 1 to ship: TN driving written test prep.

---

## Official Tennessee sources (canonical)

| Resource | URL | Role |
|----------|-----|------|
| Teen / Class D GDL page | https://www.tn.gov/safety/driver-services/classd/teengdl.html | Context, onboarding copy, future links — **not** parsed for study text |
| Driver License Manual PDF | https://www.tn.gov/content/dam/tn/safety/documents/DL_Manual.pdf | **Primary input** — official source document for this module |

The TN Driver module must treat `DL_Manual.pdf` as the canonical manual. The teen GDL page explains who the module is for and how the written test fits Tennessee's licensing path.

---

## App structure (target architecture)

```
Homeschool Tutoring App
├── Module Hub (home / first screen)
│   ├── Project ECHO (existing — recitation & dictation)
│   └── TN Driver Written Test Prep (NEW — build first)
└── Shared infrastructure
    ├── Settings (API keys, voices)
    ├── TTS + word highlighting engine
    ├── Progress / session state (per module)
    └── Upload / document ingestion pipeline
```

### Module Hub requirements

- First screen after load: grid or list of available modules
- Each module has: name, short description, icon, entry button
- Project-ECHO routes into the existing ECHO experience (may live under `/modules/echo` or similar)
- TN Driver module routes into the new experience
- Shared settings accessible from the hub (ElevenLabs key, voice selection)

### Suggested TN module hub card copy

> **Tennessee Driver Written Test**  
> Study the official Driver License Manual with read-along narration. Based on Tennessee's Class D licensing requirements.  
> [Teen GDL info](https://www.tn.gov/safety/driver-services/classd/teengdl.html)

---

## Module: Tennessee Written Driver's Test Prep

### Input

- **Canonical manual:** [Tennessee Driver License Manual (PDF)](https://www.tn.gov/content/dam/tn/safety/documents/DL_Manual.pdf)
- **Reference page:** [Tennessee Teen / Class D GDL](https://www.tn.gov/safety/driver-services/classd/teengdl.html)
- User can **upload** the PDF or **fetch from the official URL** (recommended: support both)
- **MVP scope:** text extraction only; graphics, diagrams, and layout are ignored for now
- PDF is the source of truth; store file reference, source URL, and extracted text

### Processing pipeline

1. **Ingest PDF** — parse text from all pages (client-side or server-side TBD; prefer the simplest path that works reliably on the official TN PDF)
2. **Analyze content** — identify sections relevant to the **written knowledge test** vs. ancillary content (e.g. organ donation, administrative info, forms, purely visual pages, content not covered on the written exam)
3. **Extract study material** — pull out only the necessary text, organized into logical study units (chapters, sections, or lessons)
4. **Present for study** — display extracted text on screen in readable, scrollable chunks

**Content filtering goal:** A student studying only what the module presents should not miss written-test material and should not waste time on irrelevant sections. When uncertain, prefer **including** borderline content over excluding it.

### Study experience (reader)

- Tutor character (ElevenLabs voice) reads the current section aloud
- **Word-by-word highlighting** synced to speech (reuse ECHO's timestamp + audio-clock approach)
- Full text visible before and during read-aloud (no typewriter reveal)
- **Speed control:** slider or preset buttons (e.g. 0.75×, 1×, 1.25×, 1.5×) affecting playback; highlighting stays in sync
- Navigation: previous/next section, section list or table of contents
- Optional later: bookmark progress, mark section complete

### MVP exclusions (explicitly out of scope for v1)

- Practice quiz / mock exam questions
- Image/diagram interpretation from PDF
- Other states' manuals (architecture should allow adding later)
- Speech recognition / student recitation
- Gamification / narrative (ECHO's Mainframe/Glitch story stays in the ECHO module)

---

## Technical direction

### Reuse from Project-ECHO

- `src/services/textToSpeech.ts` — ElevenLabs integration, with-timestamps endpoint, deduped playback
- Word highlight utilities — `src/utils/wordHighlight.ts`, `src/components/ui/HighlightedText.tsx`, `src/hooks/useCharacterMessage.ts`
- Settings screen pattern — API keys, voice ID
- App shell / routing — extend to hub + module routes

### New work required

- **Platform shell:** module hub home screen, routing, shared layout
- **PDF ingestion:** upload UI, text extraction (e.g. pdf.js or similar)
- **Content analysis:** LLM or rules-based pipeline to classify/extract written-test-relevant sections from raw PDF text (likely needs an API key for analysis — define in settings)
- **TN Driver module UI:** section browser, reader view, speed control wired to `playbackRate` or TTS speed + highlight sync
- **Data model:** uploaded manual metadata, extracted sections, reading progress

### Speed control implementation note

Highlighting must stay synced when speed changes. Prefer driving both from the same audio clock (`playbackRate` on Web Audio source, or equivalent) rather than independent timers.

---

## UX principles (carry over from ECHO)

- Large readable text, calm pacing, homeschool-friendly
- No blame/shame language
- Clear progress through sections
- Works without API keys in degraded mode if feasible (browser TTS fallback), but ElevenLabs is the primary experience
- Parent can configure API keys once in shared settings

---

## Phased delivery

### Phase 1 — Platform skeleton

- Module hub with placeholders for ECHO + TN Driver
- Route ECHO into existing app without breaking it
- Shared settings page

### Phase 2 — PDF → text

- Upload official TN PDF or fetch from https://www.tn.gov/content/dam/tn/safety/documents/DL_Manual.pdf
- Extract raw text; show extraction preview for debugging/parent confidence

### Phase 3 — Content curation

- Identify written-test-relevant sections
- Structure into named study sections with table of contents

### Phase 4 — Reader

- Section reader with ElevenLabs + word highlighting (port ECHO sync)
- Speed control

### Phase 5 — Polish

- Progress persistence, resume where left off, empty/error states, loading states

---

## Success criteria

- [ ] Opening the app shows a **module hub**, not ECHO directly
- [ ] User can open **TN Driver Written Test Prep** as its own module
- [ ] User can obtain the official manual via upload or fetch from the canonical PDF URL
- [ ] System extracts text and produces a **curated study guide** focused on the written test
- [ ] Each section displays full text and plays audio with **accurate word highlighting**
- [ ] User can **slow down or speed up** narration without breaking highlight sync
- [ ] Project-ECHO still works as a separate module from the hub

---

## Open decisions (agent should propose defaults)

1. **Monorepo vs. single app:** Extend this repo with `/modules/*` or rename repo to a broader platform name?
2. **PDF + curation processing:** Client-only vs. lightweight backend for LLM section classification?
3. **Tutor character:** Generic "Driving Instructor" voice vs. reuse Mainframe persona?
4. **Section granularity:** By PDF chapter headings vs. LLM-generated lesson chunks?
5. **TN manual versioning:** How to handle manual updates when the state publishes a new PDF?
6. **Manual acquisition:** Upload-only vs. "Download official manual" button that pulls from the canonical URL?

**Default recommendations for MVP:**

- Single React app in this repo, module routes
- Client-side PDF text extraction
- LLM curation via configurable API key in settings
- Generic calm tutor voice
- Section breaks following PDF chapter/heading structure where possible
- Offer both one-click fetch from the official URL and manual upload as fallback

---

## Reference links

- **Driver License Manual PDF:** https://www.tn.gov/content/dam/tn/safety/documents/DL_Manual.pdf
- **Teen GDL / Class D context:** https://www.tn.gov/safety/driver-services/classd/teengdl.html
- **Existing code reference:** `src/hooks/useCharacterMessage.ts`, `src/components/ui/HighlightedText.tsx`, `src/services/textToSpeech.ts`

---

## Agent instructions

When implementing this goal:

1. Start with **Phase 1** (hub + routing) before TN-specific logic
2. Do not break existing ECHO functionality
3. Extract shared TTS/highlighting into reusable module-agnostic components
4. Prefer small, reviewable PR-sized chunks per phase
5. Text-only PDF MVP is acceptable; do not block on graphics
6. When curating content, bias toward **inclusion** of test-relevant material
7. Use the canonical PDF URL above; do not hardcode outdated manual content
