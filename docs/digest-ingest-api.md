# Digest Ingest API

The digest ingest endpoint allows n8n (WF-0, the daily lead digest workflow) to POST digests into the app for each owner.

## Endpoint

```
POST /api/digests/ingest
```

## Authentication

The endpoint requires one of the following headers:

- `X-Digest-Secret: <secret>`
- `Authorization: Bearer <secret>`

The secret must match the `DIGEST_INGEST_SECRET` environment variable. Uses constant-time comparison for security.

**Note:** This is separate from the existing `N8N_STUDIO_SECRET` used by the Studio webhook.

## Payload

```json
{
  "owner": "ryan",
  "date": "2026-09-25",
  "search": {
    "category": "roofers",
    "location": "Tulsa, OK"
  },
  "leads": [
    {
      "place_id": "ChIJ...",
      "name": "Acme Roofing",
      "address": "123 Main St, Tulsa, OK 74103",
      "city": "Tulsa",
      "state": "OK",
      "phone": "+19185551234",
      "website": "https://...",
      "category": "Roofing contractor",
      "rating": 4.6,
      "review_count": 212,
      "score": 87,
      "tier": "Call First",
      "rank": 1,
      "angle": "short AI angle",
      "note": "short note",
      "signals": {
        "no_website": false,
        "web_presence": "own_site",
        "site_check": "Basic site",
        "site_quality": 3,
        "web_why": "q3+1page",
        "email_on_file": true,
        "agency_credit": "SomeAgency",
        "copyright_year": 2017,
        "score_parts": { "web": 12, "reviews": 8, "type": 6, "commerce": 0, "established": 4 }
      },
      "lead_group": "industrial",
      "email": "owner@acme.example",
      "emails": ["owner@acme.example"],
      "photo_count": 6,
      "gbp_photos": [
        {
          "id": "p1",
          "url": "https://lh3.googleusercontent.com/p/example-1",
          "type": "owner",
          "ts": "1710000000"
        }
      ]
    }
  ]
}
```

### Required Fields

- `owner` (string): Owner slug (`ryan`, `chase`, or `aaron`)
- `date` (string): Central Time date in `YYYY-MM-DD` format
- `leads` (array): Array of lead objects (can be empty for zero-lead days)

Each lead requires:
- `place_id` (string): Google Place ID
- `name` (string): Business name

### Optional Lead Fields

- `address`, `city`, `state`, `phone`, `website`, `category`: Contact and business info
- `rating` (number), `review_count` (integer): Google ratings
- `score` (integer): Lead score (used for sorting when rank is missing)
- `rank` (integer): Position within tier (for sorting)
- `angle` (string): AI-generated outreach angle
- `note` (string): Additional notes
- `signals` (object): Free-form metadata. The lead card prints `signals.site_check` next to the website only when that value is a non-empty string (for example `"Basic site"`). A missing, null, or blank `site_check` is skipped. Other keys such as `no_website`, `web_presence`, `site_quality`, `web_why`, `email_on_file`, `agency_credit`, `copyright_year`, and `score_parts` are stored.
- `phone` (string): E.164, for example `"+19185551234"`. The card prints it as `(918) 555-1234` and keeps the E.164 value on the `tel:` link.
- `email` (string): Stored on `businesses.email`. Trimmed. Must look like `local@domain.tld` (no spaces, 254 characters max). An empty string, a non-string, or a string that is not an email is dropped. A dropped or missing email does **not** clear a non-empty email already saved on that business. When `email` is missing or dropped and `emails` has a valid address, `emails[0]` is used for `businesses.email`. When both are present, `email` wins for that column.
- `emails` (string[]): Merged into `businesses.contacts_data.emails`. Past-lead `lead_details` sends a one-item array copied from the single stored email, `["owner@acme.example"]`. Each item is trimmed and checked with the same email rule; invalid items are removed. Comparison is case-insensitive and the first spelling is kept. Existing `contacts_data` keys other than `emails` are left in place, and existing addresses stay in the list. The field must be an array. A string, object, or JSON string is dropped and `contacts_data` is left unchanged. `[]` is valid and does not add addresses.
- `photo_count` (integer): Stored on `businesses.photo_count`. A JSON integer from `0` through `1000000`, or a string of digits such as `"6"`. Floats, negatives, booleans, and other types are dropped. A dropped or missing value does not clear a count already saved on that business. When `gbp_photos` has no usable URLs, the card still prints this count (`6 Google photos we can use in the mockup`) and does not render an image.
- `gbp_photos` (array of up to 10 objects, or a JSON string of that array): Stored as JSON on `businesses.gbp_photos`, objects unchanged. The live shape is `{ "id": "p1", "url": "https://...", "type": "owner", "ts": "1710000000" }`. `type` and `ts` may be null. An `http` or `https` URL string is also accepted. Other items are removed. At most 10 items are stored. The card renders an image only for an item whose `url` is `http` or `https`; a missing or empty `url` is skipped, and a URL that fails to load is removed so a broken image is not left on screen. `[]` clears stored photos. A non-array, a JSON string that is not an array, or an array whose every item is invalid is dropped and does not clear stored photos.
- `lead_group` (string): Stored on the new `digest_leads.lead_group` column for this digest row only. Trimmed, lowercased, and spaces become underscores. Must match `^[a-z][a-z0-9_-]{0,31}$`. `industrial`, `nonprofit`, and `random` are the groups the card labels as Industrial, Nonprofit, and Random. Any other slug in that pattern is stored as-is. Numbers, objects, and blank strings are dropped (`null`). This does not rewrite older digest rows.
- `tier` (string): `Call First | Good | Worth a look | Long shot | Skip` (case-insensitive). The daily digest can still send `Call First`. The past-lead `lead_details` response on `POST /webhook/studio` does not: its tier is only `Good`, `Worth a look`, `Long shot`, or `Skip`. Those labels are stored as `good`, `worth_a_look`, `long_shot`, and `skip`, and the score badge shows that text. It does not show Unknown for those tiers.

Unknown lead keys are ignored. A bad optional value drops that field only. The lead and the rest of the batch still save. These fields are optional: a payload that omits them behaves as before.

`gbp_photos` may also be sent as a string containing a JSON array:

```json
"gbp_photos": "[\"https://lh3.googleusercontent.com/p/example-1\",{\"id\":\"p2\",\"url\":\"https://lh3.googleusercontent.com/p/example-2\"}]"
```

## Behavior

1. **Owner Resolution**: Maps owner slug to user account via `ALLOWED_EMAILS`
2. **Upsert Businesses**: Updates existing businesses (by `user_id, place_id`) without overwriting `status`
3. **Replace Digest**: Re-posting the same owner+date replaces that day's digest and leads (safe retries)
4. **Zero-Lead Days**: POST with `leads: []` creates a digest with 0 leads (required for "no leads today" state)

## Responses

### Success (200)

```json
{
  "success": true,
  "digest_id": "abc123",
  "lead_count": 5,
  "url": "https://your-app-url/leads/today?date=2026-09-25"
}
```

The `url` field contains the absolute URL to view the digest (used in Discord notifications).

### Errors

- **400**: Invalid or missing field
  ```json
  { "message": "Missing or invalid field: owner" }
  ```
- **401**: Bad or missing secret
  ```json
  { "message": "Unauthorized" }
  ```
- **404**: Owner has no Studio account
  ```json
  { "message": "Owner \"unknown\" has no Studio account yet" }
  ```
- **500**: Missing config
  ```json
  { "message": "DIGEST_INGEST_SECRET is not configured" }
  ```

## Example cURL

```bash
curl -X POST https://your-app-url/api/digests/ingest \
  -H "Content-Type: application/json" \
  -H "X-Digest-Secret: your-secret-here" \
  -d '{
    "owner": "ryan",
    "date": "2026-09-25",
    "search": {
      "category": "roofers",
      "location": "Tulsa, OK"
    },
    "leads": []
  }'
```

## Environment Variables

Add to `.env` and Vercel:

```bash
DIGEST_INGEST_SECRET=your-random-secret-here
```

Generate a secure secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Integration with n8n

WF-0 (daily lead digest workflow) runs at 5 AM CT for each owner (`ryan`, `chase`, `aaron`). After gathering leads:

1. POST digest to `/api/digests/ingest` with `X-Digest-Secret` header
2. Parse the returned `url` from the response
3. Send a Discord message linking to the digest page
4. (Optional) Send a backup email with a slimmed-down version

The page at `/leads/today` shows the logged-in user's digest for today (Central Time). Query param `?date=YYYY-MM-DD` shows a past day.
