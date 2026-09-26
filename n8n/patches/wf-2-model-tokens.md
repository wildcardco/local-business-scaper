# WF-2 Mockup Factory — model / tokens / lookup / callback

Do not apply live until reviewed. Do not commit Config2 secrets.

## 1. Load Lead filter

Today: `place_id = {{ $json.place_id }}`.

Add a second condition: `owner = {{ $('When Called by WF-1').first().json.owner }}` so two teammates can share a Google `place_id` without colliding.

## 2. Claude Research (`@n8n/n8n-nodes-langchain.anthropic`)

Switch `modelId` from list to expression:

```
{{ $('When Called by WF-1').first().json.research_model || $('When Called by WF-1').first().json.model || 'claude-sonnet-5' }}
```

Keep `options.maxTokens` at 8000 unless a later payload field `research_max_tokens` is added.

## 3. Claude Generate HTML (the expensive call)

Live on 2026-09-26: `modelId` is still a list value, now `claude-opus-5-5`, and `options.maxTokens` is `32000`. It does not read the Studio payload. Research is still the list value `claude-sonnet-5` at 8000 tokens.

```
modelId: {{ $('When Called by WF-1').first().json.model || 'claude-opus-5-5' }}
options.maxTokens: {{ Number($('When Called by WF-1').first().json.max_tokens) || 32000 }}
```

If the LangChain node resource locator will not take an expression, insert a Set node before it named `Resolve Model` with those two fields, then point the Anthropic node at `$json.model` / `$json.max_tokens`.

## 4. Callback after Update Lead

HTTP Request POST to `{{ $('When Called by WF-1').first().json.callback_url }}`

Headers: `X-Studio-Secret` = studio secret (same as Nuxt `N8N_STUDIO_SECRET`, **not** the digest `action_secret`).

JSON body:

```json
{
  "mockup_id": "={{ $('When Called by WF-1').first().json.mockup_id }}",
  "place_id": "={{ $json.place_id }}",
  "owner": "={{ $json.owner }}",
  "status": "mockup_ready",
  "mockup_url": "={{ $json.mockup_url }}",
  "mockup_version": "={{ $json.mockup_version }}"
}
```

On generate failure, callback `status: failed` so Studio stops polling.

Also send `github_repo` (or `repo_html_url`) from Parse Deployment's `_repo_html_url` / `_full_name`. Update Lead does not store the repo today, so Studio derives `wildcardco/wildcard-mockup-<owner>-<slug>-<hash>` with the same slug and hash as the Prepare node. A callback field is the source of truth if the business is renamed later.

## 5. Feedback is dropped before the model nodes

`Resolve Lead` replaces the trigger item with the data-table row whenever `place_id` is set. That row has no `model`, `max_tokens`, `callback_url`, or `mockup_id`. `last_feedback` is a column, but WF-7 upserts it in parallel with Execute Workflow, so WF-2 can load the lead before the new notes are saved.

Build Generate Request only revises when `_feedback` is non-empty, `_version > 0`, and Fetch Current Mockup HTML returns the current file. Otherwise the notes are ignored and the page is regenerated.

Merge these trigger fields onto the lead before Prepare: `last_feedback`, `model`, `max_tokens`, `pitch_max_tokens`, `research_model`, `callback_url`, `mockup_id`, `mockup_version`. Read them from `$('When Called by WF-1').first().json`, not from the lead row.
