# WF-7 Studio Ingress

Live: `HPHWqFUK7DXBynWo` — `POST https://n8n.wildcardcreative.cloud/webhook/studio`.

Webhook responds immediately, then Execute Workflow:

- `generate_mockup` / `revise_mockup` → WF-2 `jslUBLzcV27vdLIA`
- `write_pitch` → WF-3 `wkqEVHfuCV1CsS2a`
- `add_photos` → WF-6 `7aofECe7KpM13rbH`

Digest WF-1 `/webhook/action` stays untouched.

Header: `X-Studio-Secret` must match `N8N_STUDIO_SECRET` (same value as Nuxt). Fail closed.

## Nodes (recipe)

1. **Webhook** — path `studio`, method POST, response immediately.
2. **Check secret** — IF `$header['x-studio-secret']` equals the studio secret stored in a Config Set node (do not reuse git for that value).
3. **Normalize** — Code: copy body fields; default `model` to `claude-fable-5`, `max_tokens` to `16000`, `pitch_max_tokens` to `1500`, `research_model` to `claude-sonnet-5`.
4. **Upsert Lead** — Data Table `leads` (`HnKWbJiHsPeWOtMk`). Match `place_id` **and** `owner`. Write `business_name`, `website`, `phone` (string), `address`, `category`, `rating`, `review_count`, `last_feedback`, `photo_urls`, `status`.
5. **Switch** on `$json.action`:
   - `generate_mockup` / `revise_mockup` → Execute Workflow WF-2 (`jslUBLzcV27vdLIA`) with the full JSON (including `model`, `max_tokens`, `research_model`, `last_feedback`, `callback_url`, `mockup_id`)
   - `write_pitch` → Execute Workflow WF-3 (`wkqEVHfuCV1CsS2a`)
   - `add_photos` → Execute Workflow WF-6 (`7aofECe7KpM13rbH`)
6. **Respond** `{ "ok": true, "action": …, "place_id": … }`

WF-2 currently has no webhook. This ingress is the only public entry from Nuxt. Digest WF-1 `/webhook/action` stays untouched.
