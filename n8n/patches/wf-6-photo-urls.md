# WF-6 Image Enhancer — photo_urls from Studio

Do not apply live until reviewed.

Studio uploads land in ImageKit, then Nuxt POSTs `photo_urls: string[]` on `add_photos`.

1. Resolve Lead should copy `photo_urls` from the trigger JSON (array or JSON string) onto the lead.
2. Prefer those URLs over site-scrape / Claude image search when the array is non-empty.
3. Persist `photo_urls` on the leads table so revisions keep them.
4. Callback Nuxt after commit:

```json
{
  "mockup_id": "={{ $('When Called').first().json.mockup_id }}",
  "place_id": "={{ $json.place_id }}",
  "owner": "={{ $json.owner }}",
  "status": "mockup_ready",
  "mockup_url": "={{ $json.mockup_url }}",
  "photo_urls": "={{ $json.photo_urls }}"
}
```

WF-5 `/webhook/revise` stays notes-only. In-app photos never go through that form.
