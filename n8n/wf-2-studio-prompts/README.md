# WF-2 HTML prompts — one look per business

Live workflow: **WF-2 Mockup Factory**, id `jslUBLzcV27vdLIA`. Nothing in this folder has been applied to that workflow. Do not paste it until you mean to change the next mockup run. Do not change `N8N_STUDIO_SECRET`, other env vars, or the Studio list that hides deployments which 404.

## What is wrong today

`Build Generate Request` sends every model the same system prompt. That prompt tells the model to add "tactile micro-details (custom cursors, grain/texture, unusual dividers)". The research step already asks for `design_direction`, `palette_mood`, `type_character`, and `signature_layout_move`. The HTML step then ignores that point of view and lays the same decorations on top, including checkered borders.

## Which node each file replaces

| File | WF-2 node |
|---|---|
| `build-generate-request.js` | **Replaces** the jsCode of **Build Generate Request**. Keep the node name. Extract HTML still reads `$('Build Generate Request')`. |
| `system/claude-opus-5-5.txt` | The system prompt that file selects when `_html_model` is `claude-opus-5-5`. Inlined in `build-generate-request.js`. |
| `system/claude-fable-5-1.txt` | Same, for `claude-fable-5-1`. |
| `system/claude-opus-5.txt` | Same, for `claude-opus-5`. |
| `system/claude-sonnet-5.txt` | Same, for `claude-sonnet-5`. |
| `system/claude-haiku-4-5.txt` | Same, for `claude-haiku-4-5`. |
| `system/claude-fable-5.txt` | Same, for `claude-fable-5`. |
| `system/claude-opus-4-6.txt` | Same, for `claude-opus-4-6`. |
| `build-visual-reference-request.js` | **New** Code node **Build Visual Reference Request**. Does not replace a node. Insert after **Parse Research**. |
| `system/visual-reference.txt` | The system prompt inlined in that new node. |
| `parse-visual-reference.js` | **New** Code node **Parse Visual Reference**. Does not replace a node. Insert after the new Anthropic node below. |

`check.mjs` is a local check (`node n8n/wf-2-studio-prompts/check.mjs`). It is not a workflow node.

## The step between research and HTML

Today: `Parse Research` → `Build Generate Request` → `Claude Generate HTML`.

After you paste:

`Parse Research` → `Build Visual Reference Request` → `Claude Visual Reference` → `Parse Visual Reference` → `Build Generate Request` → `Claude Generate HTML`.

`Claude Visual Reference` is a new Anthropic node, a copy of **Claude Research**:

- Prompt / message: `{{ $json._user }}`
- System: `{{ $json._system }}`
- Model expression: `{{ $('When Called by WF-1').first().json.research_model || 'claude-sonnet-5' }}`
- Max tokens: `2000`
- Leave temperature, top_p, and top_k unset. Claude Sonnet 5 returns a 400 if those are not the default.

That call chooses one real, named visual reference for this trade and this town. "Modern and clean" is rejected. `Parse Visual Reference` stores it on `_visual_reference`. `Build Generate Request` writes the HTML user prompt from the research brief plus that reference. The HTML model follows the reference. It does not get a house style.

On a revision (feedback, version > 0, and current HTML from **Fetch Current Mockup HTML**), `Build Generate Request` still edits the current file in place. That branch is the same text as today. The reference is not applied over the existing page.

If the chooser nodes are not wired yet, `Build Generate Request` still drops the house style and still bans the shared decorations. It then uses the brief's direction only when that direction is not a vague label.

## Point the HTML node at the same model as the prompt

`Build Generate Request` sets `_html_model` from the Studio `model` on **When Called by WF-1**, otherwise `claude-opus-5-5` (the model **Claude Generate HTML** is pinned to today). `_html_model_fallback` is true when the trigger asked for an id that has no prompt here; the prompt and `_html_model` then both use `claude-opus-5-5`.

On **Claude Generate HTML**, set the model to `{{ $json._html_model }}`. Leave max tokens at `32000`. Leave the message on `{{ $json._user }}` and the system message on `{{ $json._system }}`. If that resource locator will not take an expression, use the Set-node note in `n8n/patches/wf-2-model-tokens.md`.

Pasting the code without that model expression leaves the node on `claude-opus-5-5` while the system prompt follows Settings.

## What each HTML prompt follows

Hard rules in every prompt: one HTML file, no fabricated awards, testimonials, or phone numbers, real image URLs only, `<meta name="robots" content="noindex, nofollow">`, the current year, raw HTML with no preamble, footer text `Website sample by Wild Card Creative Co`.

Every prompt also forbids a checkered or gingham border, a repeating diagonal stripe used as a divider, a grain overlay, and a custom cursor. Those are the shared decorations this factory already produces. The Opus 5.5 page says to extend the named list when a result shows a new default.

| Model | Page | What this prompt takes from it |
|---|---|---|
| `claude-opus-5-5` | [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5) | Frontend design defaults: name the patterns, because a general "avoid a generic AI look" swaps one default for another. Named here: cream or off-white background, italic accent words in headlines, numbered `01/02/03` section labels, monospace labels, pill-shaped buttons, plus the factory decorations above. No instruction to think carefully. No reasoning in the response. |
| `claude-fable-5-1` | [Prompting Claude Fable 5.1](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1) | The Fable 5 prompt, then `Please remove all mannered prose.` and the page's autonomous sentence (`The user is not watching in real time…`). The tool-call sentences are left out because this node has no tools. No anti-formatting block. |
| `claude-fable-5` | [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5) | The reason for the request, then a short instruction. Includes the page's "Don't add features…" lines and "A one-shot operation usually doesn't need a helper." No reasoning in the response. The "lead with the TLDR" line is left out because the response has to be the HTML document. |
| `claude-opus-5` | [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5) | Scope ("Deliver what was asked…") and written-deliverable length ("do not pad with filler sections…"). No double-check or verification line. The page's "say so in a sentence" clause is left out because it would sit in front of the HTML. |
| `claude-sonnet-5` | [Prompting Claude Sonnet 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5) | A concrete spec in the user message, applied to every section, not only the first screen. The `<frontend_aesthetics>` snippet from that page. The chooser is the concrete spec; this pipeline has nobody to pick among four directions. Do not set temperature. |
| `claude-opus-4-6` | [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices), Frontend design | The `<frontend_aesthetics>` snippet for Opus 4.5 and Opus 4.6, then the border bans so "geometric patterns" does not become a checkered border. |
| `claude-haiku-4-5` | Prompting best practices (no separate Haiku page) | A direct role, the reference, and raw HTML with no preamble. No design rules invented for Haiku. |

These prompts do not set effort, thinking, or max tokens. The pages treat effort as an API setting, not as a line in the prompt.
