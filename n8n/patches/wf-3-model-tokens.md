# WF-3 Pitch Writer — model / tokens from payload

Do not apply live until reviewed.

`Build Pitch Request` currently hardcodes:

```js
const body = { model: "claude-sonnet-5", max_tokens: 1500, system, messages: [...] }
```

Replace with:

```js
const trig = $('When Called').first().json
const d = $input.first().json
const model = trig.model || d.model || 'claude-sonnet-5'
const max_tokens = Number(trig.pitch_max_tokens || trig.max_tokens || 1500)
const body = { model, max_tokens, system, messages: [{ role: 'user', content: user }] }
```

Keep the existing system prompt and JSON `{ subject, body }` contract.

## Get Lead

Add `owner` alongside `place_id`, same as WF-2.

## Callback after Update Lead

POST `callback_url` with `X-Studio-Secret`:

```json
{
  "mockup_id": "={{ $('When Called').first().json.mockup_id }}",
  "place_id": "={{ $json.place_id }}",
  "owner": "={{ $json.owner }}",
  "status": "pitch_ready",
  "pitch_draft": "={{ $json.pitch_draft }}",
  "pitch_subject": "={{ $json._subject }}",
  "pitch_version": "={{ $json.pitch_version }}"
}
```

Digest email to the owner still sends. Studio just mirrors the same draft.
