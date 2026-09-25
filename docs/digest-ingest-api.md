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
        "agency_credit": "SomeAgency",
        "copyright_year": 2017
      }
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
- `tier` (string): One of `Call First | Good | Worth a look | Long shot | Skip` (case-insensitive)
- `rank` (integer): Position within tier (for sorting)
- `angle` (string): AI-generated outreach angle
- `note` (string): Additional notes
- `signals` (object): Free-form metadata (e.g., `no_website`, `agency_credit`, `copyright_year`)

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
  "url": "https://app.example.com/leads/today?date=2026-09-25"
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
curl -X POST https://app.example.com/api/digests/ingest \
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
