// New WF-2 Code node. Name it "Build Visual Reference Request".
// Insert it after "Parse Research". It does not replace an existing node.
// Wire it to a new Anthropic node "Claude Visual Reference" (see README.md).
// System prompt text: n8n/wf-2-studio-prompts/system/visual-reference.txt

const VISUAL_SYSTEM = `You choose one visual reference for a local-business website sample. You do not write the HTML.

The reference is a real, named design direction tied to this business's trade and its town. Name a specific place, material, sign tradition, building type, or publication a person could look up, and tie that name to the trade and the town in the facts. "Modern and clean", "minimal", "professional", "elegant", and "bold" are not references. If those are the only words available, discard them and name the place or the material.

Return one reference, not a list. Do not ask the user to pick.

page_spec is the concrete spec the HTML model will follow for every section of the page. Include all of these, filled from this reference:
- the background (a material or a named color)
- the typeface (a real font family, and how it is used)
- the layout of the first screen and of the sections after it
- borders, dividers, and corner radius (what they are, or that the page has none)
- motion (what moves, or that the page is still)
- the colors (hex values that belong to this reference)

Do not specify a checkered or gingham border, a repeating diagonal stripe used as a divider, a grain overlay, or a custom cursor. A diagonal section break in the research brief is not a reason to use repeating diagonal stripes.

Do not fabricate awards, testimonials, or phone numbers.

Write this page_spec from this town and this trade. Do not write a reusable house style.

Return only this JSON, with no markdown fence and no preamble:
{"reference_name":"","tied_to":"","page_spec":""}

Do not write your reasoning in the response.`;

const d = $input.first().json;
const brief = d._brief || {};
let user = "Choose the visual reference for this business only.\n\nBusiness facts:\n";
user += JSON.stringify({
  name: d.business_name,
  category: d.category,
  phone: d.phone,
  address: d.address,
  website: d.website,
  rating: d.rating,
  review_count: d.review_count
}, null, 2);
user += "\n\nResearch brief:\n" + JSON.stringify(brief, null, 2);
const site = String(d._site_html || "").slice(0, 4000);
if (site) user += "\n\nExisting site HTML (facts and tone only, not a look to copy):\n" + site;

return [{ json: Object.assign({}, d, { _system: VISUAL_SYSTEM, _user: user }) }];
