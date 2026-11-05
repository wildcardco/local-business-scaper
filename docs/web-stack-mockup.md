# Web stack mockups

The generate-mockup dialog has two builds.

| Mode | What runs |
|---|---|
| **Plain HTML** | The current Studio workflow. The lead payload is unchanged and is posted to `N8N_STUDIO_WEBHOOK_URL`. This is the default. |
| **Web Stack** | The same lead payload, plus the build contract below, posted to `N8N_WEB_STACK_WEBHOOK_URL`. |

Web stack is a React, Vite, and Tailwind site built by a Cursor Cloud Agent on `grok-4.7`. There is no on-demand fallback. If the web stack webhook is missing or returns an error, the app does not call the plain HTML webhook and does not start another model.

Pitch, photo, and revision actions stay on the plain HTML workflow.

## Environment variables

Set these on the server (Vercel project env, or local `.env`). Do not prefix them with `NUXT_PUBLIC_`. Do not commit values.

| Name | Required | Purpose |
|---|---|---|
| `N8N_WEB_STACK_WEBHOOK_URL` | Yes, for Web Stack | `http` or `https` URL of the n8n webhook that starts the cloud agent. No default. No username or password in the URL. |
| `N8N_WEB_STACK_SECRET` | No | When set, the app sends it as the `X-Web-Stack-Secret` header. When empty, the header is omitted. The value is never written into the JSON body, logs, or the page. |

Plain HTML still uses `N8N_STUDIO_WEBHOOK_URL` and `N8N_STUDIO_SECRET`.

## Request

Web stack sends the Studio lead payload (`action`, `place_id`, `owner`, `business_name`, contact fields, `model`, `max_tokens`, `callback_url`, `mockup_id`, and the rest) and adds:

```json
{
  "build_mode": "web_stack",
  "stack": "react-vite-tailwind",
  "agent_model": "grok-4.7",
  "on_demand_fallback": false
}
```

`model` remains the plain-HTML Studio model so the lead payload stays the same. The web stack helper should use `agent_model` and must not fall back to an on-demand model.

## Response

The webhook should answer when the agent starts, not when the site is finished. The app reads:

| Field | Use |
|---|---|
| `agent_id` | Open agent link: `https://cursor.com/agents/<agent_id>` |
| `agent_url` | Used only when it is already `https://cursor.com/agents/<agent_id>` and `agent_id` is missing |
| `preview_url` | Preview link. `http` or `https` only |
| `status` | Shown as the build status. `building` / `running` / `queued` stay in progress. `ready` / `success` / `completed` become ready. `failed` / `error` become failed |
| `error` | Shown when present. A string, or `{ "message": "..." }` |

An empty `200` means the job was accepted and is still building. `ok: false` with none of the fields above is a failure. A non-2xx response is a failure. Neither one starts plain HTML.

A later update can `POST` the same fields to the `callback_url` on the lead payload (`/api/mockups/webhook`) with header `X-Studio-Secret`. Include `build_mode: "web_stack"` or `agent_id` / `preview_url` so the app stores them on that mockup. Plain HTML callbacks are unchanged.

## What the dashboard shows

While a web stack build exists, the lead card and the Studio page show the build status, the preview link when `preview_url` is present, and **Open agent** when `agent_id` is present. Plain HTML cards still show the live Studio page only.
