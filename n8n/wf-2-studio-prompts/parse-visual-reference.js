// New WF-2 Code node. Name it "Parse Visual Reference".
// Insert it after the Anthropic node "Claude Visual Reference".
// It does not replace an existing node. "Build Generate Request" writes the HTML user prompt from _visual_reference.

function extractText(resp) {
  if (typeof resp === "string") return resp;
  if (resp && typeof resp.text === "string") return resp.text;
  if (resp && typeof resp.content === "string") return resp.content;
  if (resp && Array.isArray(resp.content)) {
    var block = resp.content.find(function (b) { return b && b.type === "text"; }) || {};
    return block.text || "";
  }
  if (resp && typeof resp.message === "string") return resp.message;
  return "";
}

function vagueReferenceName(name) {
  return /^(modern( and clean)?|clean|minimal(ist)?|professional|elegant|bold|contemporary)$/i.test(String(name || "").trim());
}

function parseReference(text) {
  var raw = String(text || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  var parsed = null;
  try { parsed = JSON.parse(raw); } catch (e) {
    var match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch (e2) { parsed = null; }
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  var name = String(parsed.reference_name || "").trim();
  var vague = vagueReferenceName(name) || /modern and clean/i.test(name);
  return {
    reference_name: vague ? "" : name.slice(0, 240),
    tied_to: String(parsed.tied_to || "").trim().slice(0, 500),
    page_spec: String(parsed.page_spec || "").trim().slice(0, 4000),
    vague_name: vague
  };
}

const resp = $input.first().json;
const ctx = $("Build Visual Reference Request").first().json;
const text = extractText(resp);
const reference = parseReference(text);

return [{ json: Object.assign({}, ctx, {
  _visual_reference: reference,
  _visual_reference_raw: String(text || "").slice(0, 8000),
  _visual_reference_missing: !reference
}) }];
