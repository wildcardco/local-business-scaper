# n8n patches — Mockup Studio

WF-7 Studio Ingress is live: `HPHWqFUK7DXBynWo`, `POST https://n8n.wildcardcreative.cloud/webhook/studio`.

WF-2/3/6 model-token expression patches are still optional. Do not paste `action_secret` or API keys into git.

Checked live 2026-09-26: WF-2 HTML is pinned to `claude-opus-5-5` at 32000 tokens and research to `claude-sonnet-5` at 8000. Neither node reads the Studio `model` field. WF-7's header credential must match `N8N_STUDIO_SECRET`. See `wf-7-studio-ingress.md` and `wf-2-model-tokens.md`.

Current live defaults (Aug 2026, superseded for the HTML model by the note above):

| Call | Workflow | Model | Tokens |
|---|---|---|---|
| Research brief | WF-2 `Claude Research` | `claude-sonnet-5` | 8000 |
| Mockup HTML | WF-2 `Claude Generate HTML` | `claude-fable-5` | 16000 |
| Pitch email | WF-3 `Build Pitch Request` | `claude-sonnet-5` | 1500 |

Dashboard Settings → Mockup AI stores per-user `ai_model`, `ai_max_tokens`, `pitch_max_tokens` and sends them on every Studio fire:

```json
{
  "action": "generate_mockup",
  "place_id": "…",
  "owner": "ryan",
  "model": "claude-fable-5",
  "max_tokens": 16000,
  "pitch_max_tokens": 1500,
  "research_model": "claude-sonnet-5",
  "callback_url": "https://…/api/mockups/webhook",
  "mockup_id": "…"
}
```

`research_model` stays Sonnet unless the user picked Haiku (then research uses Haiku too).

## Files

- `wf-7-studio-ingress.md` — new `POST /webhook/studio` router
- `wf-2-model-tokens.md` — expressions on Anthropic nodes + owner filter + callback
- `wf-3-model-tokens.md` — `$json.model` / `pitch_max_tokens` in Build Pitch Request
- `wf-6-photo-urls.md` — pass `photo_urls` through from trigger

## After apply

1. Set `N8N_STUDIO_WEBHOOK_URL=https://n8n.wildcardcreative.cloud/webhook/studio`
2. Set `N8N_STUDIO_SECRET` to the same value the WF-7 webhook header check uses
3. Point WF-2/3/6 HTTP callbacks at `{app origin}/api/mockups/webhook` with `X-Studio-Secret`
4. Keep WF-1 `/webhook/action` tokens working for digest email
