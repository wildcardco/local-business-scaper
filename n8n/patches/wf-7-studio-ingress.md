# WF-7 Studio Ingress

Live: `HPHWqFUK7DXBynWo` — `POST https://n8n.wildcardcreative.cloud/webhook/studio`.

Webhook responds immediately, then Execute Workflow:

- `generate_mockup` / `revise_mockup` → WF-2 `jslUBLzcV27vdLIA`
- `write_pitch` → WF-3 `wkqEVHfuCV1CsS2a`
- `add_photos` → WF-6 `7aofECe7KpM13rbH`

Digest WF-1 `/webhook/action` stays untouched.

Header: credential **Studio secret** (`bYKoHkwycoKjqI1A`), header name `X-Studio-Secret`. It must equal the current Vercel `N8N_STUDIO_SECRET` (rotated 2026-09-25). A mismatch returns HTTP 403 `Authorization data is wrong!` and creates no execution. The last successful WF-7 execution was 2026-09-22 (`748`). Sync from n8n does **not** use this secret; it uses `N8N_API_KEY` with scope `dataTableRow:read` (and `dataTableRow:update` so feedback can be written before the webhook).

## What Nuxt sends

`POST https://n8n.wildcardcreative.cloud/webhook/studio`

Header: `X-Studio-Secret: <N8N_STUDIO_SECRET>`

```json
{
  "action": "generate_mockup | revise_mockup | write_pitch | add_photos",
  "place_id": "ChIJ… or studio_<user>_<mockup>",
  "owner": "ryan | chase | aaron",
  "business_name": "…",
  "website": null,
  "phone": null,
  "address": "street, city, ST",
  "category": null,
  "rating": null,
  "review_count": null,
  "last_feedback": "revision notes, or null",
  "extra_prompt": "same notes when this is a revision",
  "photo_urls": [],
  "model": "claude-opus-5-5",
  "max_tokens": 16000,
  "pitch_max_tokens": 1500,
  "research_model": "claude-sonnet-5",
  "callback_url": "https://<app>/api/mockups/webhook",
  "user_email": "ryan@wildcardcreativeco.com",
  "mockup_id": "…",
  "business_id": "…",
  "mockup_version": 1
}
```

`revise_mockup` is the feedback action. Before this POST, Nuxt also `PATCH /api/v1/data-tables/HnKWbJiHsPeWOtMk/rows/update` with `last_feedback`, filtered by `place_id` and `owner`, so the lead row has the notes even if the factory starts immediately.

## Required workflow changes

Normalize already copies `last_feedback`, `model`, `max_tokens`, `research_model`, `callback_url`, and `mockup_id`. Also copy `mockup_version`.

Upsert Studio Lead currently matches **only** `place_id` and runs **in parallel** with Route Studio Action → Execute Workflow. Change both:

1. Match `place_id` **and** `owner`.
2. Connect Upsert Studio Lead **before** Route Studio Action, and do not start WF-2 until the upsert finishes.
3. Keep writing `last_feedback` from the normalized payload (already mapped).

The leads table has no `city` column and no GitHub column. Nuxt parses city from `address` (`…, City, ST 12345`). Optional: on the WF-2 callback, send `github_repo` or `repo_html_url` (`https://github.com/wildcardco/wildcard-mockup-…`). Until then Studio derives that repo name with the same slug and hash as WF-2 Prepare.

Callback `POST {callback_url}` with `X-Studio-Secret` is still not in WF-2. Without it, Studio only learns the new URL by reading the leads table.

## Nodes (recipe)

Live nodes are Webhook (header auth, not a separate IF), Normalize, then Upsert and Route in parallel. The list below is the order they should run in.

1. **Webhook** — path `studio`, method POST, header auth `X-Studio-Secret`, response immediately.
2. **Normalize** — copy body fields, including `mockup_version`. Default `model` to `claude-opus-5-5`, `max_tokens` to `32000`, `pitch_max_tokens` to `1500`, `research_model` to `claude-sonnet-5`.
3. **Upsert Lead** — Data Table `leads` (`HnKWbJiHsPeWOtMk`). Match `place_id` **and** `owner`. Write `business_name`, `website`, `phone` (string), `address`, `category`, `rating`, `review_count`, `last_feedback`, `photo_urls`, `status`. Finish this before the switch.
4. **Switch** on `$json.action`:
   - `generate_mockup` / `revise_mockup` → Execute Workflow WF-2 (`jslUBLzcV27vdLIA`) with the full JSON (including `model`, `max_tokens`, `research_model`, `last_feedback`, `callback_url`, `mockup_id`)
   - `write_pitch` → Execute Workflow WF-3 (`wkqEVHfuCV1CsS2a`)
   - `add_photos` → Execute Workflow WF-6 (`7aofECe7KpM13rbH`)
5. **Respond** `{ "ok": true, "action": …, "place_id": … }`

WF-2 currently has no webhook. This ingress is the only public entry from Nuxt. Digest WF-1 `/webhook/action` stays untouched.
