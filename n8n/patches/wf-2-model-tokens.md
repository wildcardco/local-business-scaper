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

Current hardcoded: `claude-fable-5`, `maxTokens: 16000`.

```
modelId: {{ $('When Called by WF-1').first().json.model || 'claude-fable-5' }}
options.maxTokens: {{ Number($('When Called by WF-1').first().json.max_tokens) || 16000 }}
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
