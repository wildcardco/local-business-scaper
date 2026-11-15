# Past lead details

Studio can ask n8n for the details already saved for one Google place. The button is on the Studio lead page only. Today's Leads and the business page do not call this.

The ingest rules in `docs/digest-ingest-api.md` still apply. A missing or empty value does not clear a saved email, phone, photo count, photo list, angle, score, tier, lead group, or site check.

## App route

`POST /api/businesses/:id/fetch-details`

Logged-in users only, same session as the other app APIs. The business must belong to that user.

The route reads `businesses.place_id`. It must be a Google id starting with `ChIJ`. Otherwise the response is `400` with message `No Google place ID`.

## n8n request

`POST` `N8N_STUDIO_WEBHOOK_URL` (WF-7, `/webhook/studio`), the same webhook Research Report uses.

Header: `X-Studio-Secret: N8N_STUDIO_SECRET`

Timeout: 15 seconds.

```json
{
  "action": "lead_details",
  "owner": "ryan",
  "place_id": "ChIJlyMchiWjEYgRaD7CAYYYOoc"
}
```

`owner` is `ryan`, `chase`, or `aaron` when the signed-in email maps to one of those. It is omitted when it does not.

## n8n response

Found:

```json
{
  "ok": true,
  "found": true,
  "place_id": "ChIJlyMchiWjEYgRaD7CAYYYOoc",
  "email": "owner@acme.example",
  "emails": ["owner@acme.example"],
  "photo_count": 29,
  "gbp_photos": [
    {
      "id": "p1",
      "url": "https://lh3.googleusercontent.com/p/example",
      "type": "owner",
      "ts": "1710000000"
    }
  ],
  "lead_group": "industrial",
  "angle": "Dated site next to a full photo set.",
  "phone": "+12196966430",
  "score": 37,
  "tier": "Worth a look",
  "site_check": "Basic site"
}
```

Every field except `ok`, `found`, and `place_id` is optional.

- `emails` is usually one item copied from the single stored email. It is merged into `businesses.contacts_data.emails`. Other contact keys stay.
- `email`, when present and valid, wins over `emails[0]` for `businesses.email`. An empty email does not clear a saved one.
- `phone` is E.164. It is written only when `businesses.phone` is empty.
- `photo_count` is an integer. `0` does not replace a count above zero.
- `gbp_photos` is up to 10 objects `{id, url, type, ts}` or URL strings. Objects are stored unchanged. An empty list, or a list with no http(s) `url` when photos are already saved, does not clear them. The page uses `url` for the image and `photo_count` for the note when there is no URL.
- `lead_group` is `industrial`, `nonprofit`, or `random`.
- `tier` is `Good`, `Worth a look`, `Long shot`, or `Skip`. `Call First` is still accepted if a digest sends it. The badge uses that label and does not say Unknown.
- `site_check` is stored on the latest `digest_leads.signals` object. A missing or blank value is skipped. Other signal keys stay.
- `angle`, `score`, and `tier` update that same digest row. When the lead has never been on a digest, they are saved on a lookup row the business page can read. They are not added to today's digest.

Not found:

```json
{ "ok": true, "found": false, "place_id": "ChIJlyMchiWjEYgRaD7CAYYYOoc" }
```

The app shows `No saved details found for this lead` and does not write.

`401` or `403` means the Studio secret was rejected. A `404`, or a body that says the action is unknown, shows `Lookup not available yet`. A timeout shows `The lookup did not answer in time. Try again.`

## App response

Found returns the values now on the lead, after the merge:

```json
{
  "ok": true,
  "found": true,
  "place_id": "ChIJlyMchiWjEYgRaD7CAYYYOoc",
  "email": "owner@acme.example",
  "emails": ["owner@acme.example"],
  "photo_count": 29,
  "gbp_photos": [{ "id": "p1", "url": "https://lh3.googleusercontent.com/p/example", "type": "owner", "ts": "1710000000" }],
  "phone": "+12196966430",
  "lead_group": "industrial",
  "angle": "Dated site next to a full photo set.",
  "score": 37,
  "tier": "Worth a look",
  "site_check": "Basic site"
}
```

Not found:

```json
{
  "ok": true,
  "found": false,
  "place_id": "ChIJlyMchiWjEYgRaD7CAYYYOoc",
  "message": "No saved details found for this lead"
}
```
