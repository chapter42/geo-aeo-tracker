# Phase 3: Bulk Upload van Prompts - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Add bulk prompt import capability to the existing Prompt Hub tab. Users can paste multiple prompts at once (one per line) instead of adding them one-by-one. No changes to how prompts are stored, run, or displayed — only the input method is expanded.

</domain>

<decisions>
## Implementation Decisions

### Invoermethode
- Textarea met meerdere regels als primaire invoer (multi-line tekstveld)
- Één prompt per regel — alleen nieuwe regels als scheidingsteken (geen komma's/puntkomma's)
- Geen CSV bestandsupload — alleen textarea met plakken
- Geen preview van herkende prompts — direct toevoegen bij klikken

### Validatie & feedback
- Duplicaten stil overslaan — geen foutmelding per duplicaat, wel samenvatting na afloop ("8 van 10 prompts toegevoegd, 2 duplicaten overgeslagen")
- Lege regels en whitespace automatisch opschonen — geen melding nodig
- Geen maximale lengte per prompt — de scrape API bepaalt uiteindelijk de limieten
- Geen {brand} placeholder validatie — gebruikers weten zelf of ze het willen gebruiken

### Limiet & schaal
- Geen limiet op aantal prompts per bulk import
- Geen totale limiet op prompt-bibliotheek

### UI-integratie
- 'Bulk Import' knop naast de bestaande 'Add' knop
- Textarea verschijnt na klikken op de knop (toggle) — niet altijd zichtbaar
- Knop en textarea verdwijnen na succesvolle import of bij annuleren

### Claude's Discretion
- Exacte knopstyling (primair vs secundair) — past bij bestaande UI patterns
- Bevestigingsmelding na import (toast vs inline) — kies wat past bij de app
- Textarea hoogte en placeholder tekst
- Animatie/transitie bij toggle van textarea

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PromptHubTab` component (`components/dashboard/tabs/prompt-hub-tab.tsx`): Bestaande prompt management UI met `onAddCustomPrompt` callback — bulk import hergebruikt dezelfde callback per prompt
- `customPrompts: string[]` in AppState: Bestaande prompt storage array — bulk voegt items toe aan dezelfde array
- `bd-btn-primary` en `bd-chip` CSS klassen: Bestaande knopstijlen voor primaire en secundaire acties
- `bd-input` CSS klasse: Bestaand tekstveld styling

### Established Patterns
- State management via props + callbacks (geen Redux/Context) — bulk import volgt hetzelfde patroon
- `onAddCustomPrompt(value: string)` voegt één prompt toe — bulk import roept dit meerdere keren aan
- Tailwind CSS met `th-*` CSS custom properties voor theming

### Integration Points
- `PromptHubTab` props interface moet geen wijzigingen nodig hebben — `onAddCustomPrompt` wordt hergebruikt
- Alle logica voor bulk-parsing (splitsen, dedupliceren, trimmen) kan in de component zelf

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-onderzoek-de-mogelijkheid-tot-een-een-bulkupload-van-prompts*
*Context gathered: 2026-03-01*
