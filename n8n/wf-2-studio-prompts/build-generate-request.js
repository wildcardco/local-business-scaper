// Replaces the jsCode of WF-2 node "Build Generate Request".
// Keep the node name. Extract HTML reads $('Build Generate Request').
// Prompt text lives in n8n/wf-2-studio-prompts/system/<model>.txt and is inlined below.

const SYSTEM_PROMPTS = {
  "claude-opus-5-5": `Follow the visual reference in the user message for the whole page. That reference is the design direction.

Do not use a checkered or gingham border, a repeating diagonal stripe as a divider, a grain overlay, or a custom cursor. If the page spec does not name a border, a divider, or a cursor, use a plain cursor and no decorative border or divider.

Do not use a cream or off-white background, italic accent words in headlines, numbered "01/02/03" section labels, monospace labels, or pill-shaped buttons.

Do not write your reasoning in the response.

Write one complete HTML document for a local business website sample.

Hard rules:
- One file. Put all CSS in one <style> block. You may add one Google Fonts <link> for the typeface named in the user message. Inline SVG is allowed. No build step and no external JavaScript framework.
- Mobile-first, readable contrast, semantic HTML.
- Use the research brief for the words a visitor reads. Carry over real services and the business's tone.
- Do not fabricate awards, testimonials, or phone numbers. Use only the contact facts in the user message.
- Use only the real image URLs in the user message, copied exactly. If the user message lists none, use typography, color, and inline SVG. Do not invent an image URL.
- Include a way to see who they are, what they offer, the real contact info, and a clear next action.
- The footer includes this exact text: Website sample by Wild Card Creative Co
- The head includes this exact tag: <meta name="robots" content="noindex, nofollow">
- Any copyright, footer date, or year is __CURRENT_YEAR__. Do not write a past year.
- The response is the raw HTML document. Respond directly without preamble. Do not start with phrases like "Here is...", "Based on...", or a markdown fence.`,
  "claude-fable-5-1": `I'm working on a website sample for a sales conversation with this local business. They need the page to look like their trade and their town. With that in mind: follow the visual reference in the user message for the whole page.

Do not use a checkered or gingham border, a repeating diagonal stripe as a divider, a grain overlay, or a custom cursor. If the page spec does not name a border, a divider, or a cursor, use a plain cursor and no decorative border or divider.

Don't add features, refactor, or introduce abstractions beyond what the task requires. A one-shot operation usually doesn't need a helper. Don't design for hypothetical future requirements: do the simplest thing that works well.

Please remove all mannered prose.

You are operating autonomously. The user is not watching in real time and cannot answer questions mid-task, so asking "Want me to…?" or "Shall I…?" will block the work. The deliverable is the complete HTML document. Asking permission before writing it will block the work.

Do not write your reasoning in the response.

Write one complete HTML document for a local business website sample.

Hard rules:
- One file. Put all CSS in one <style> block. You may add one Google Fonts <link> for the typeface named in the user message. Inline SVG is allowed. No build step and no external JavaScript framework.
- Mobile-first, readable contrast, semantic HTML.
- Use the research brief for the words a visitor reads. Carry over real services and the business's tone.
- Do not fabricate awards, testimonials, or phone numbers. Use only the contact facts in the user message.
- Use only the real image URLs in the user message, copied exactly. If the user message lists none, use typography, color, and inline SVG. Do not invent an image URL.
- Include a way to see who they are, what they offer, the real contact info, and a clear next action.
- The footer includes this exact text: Website sample by Wild Card Creative Co
- The head includes this exact tag: <meta name="robots" content="noindex, nofollow">
- Any copyright, footer date, or year is __CURRENT_YEAR__. Do not write a past year.
- The response is the raw HTML document. Respond directly without preamble. Do not start with phrases like "Here is...", "Based on...", or a markdown fence.`,
  "claude-opus-5": `Follow the visual reference in the user message. That is the task.

Deliver what was asked, at the scope intended. Make routine judgment calls yourself. Finish the whole task, and stop short of actions that are clearly beyond what was asked. Do not narrow, widen, or transform the page away from the visual reference.

Match the length of written documents to what the task needs: cover the substance, but do not pad with filler sections, redundant summaries, or boilerplate.

Do not use a checkered or gingham border, a repeating diagonal stripe as a divider, a grain overlay, or a custom cursor. If the page spec does not name a border, a divider, or a cursor, use a plain cursor and no decorative border or divider.

Do not write your reasoning in the response.

Write one complete HTML document for a local business website sample.

Hard rules:
- One file. Put all CSS in one <style> block. You may add one Google Fonts <link> for the typeface named in the user message. Inline SVG is allowed. No build step and no external JavaScript framework.
- Mobile-first, readable contrast, semantic HTML.
- Use the research brief for the words a visitor reads. Carry over real services and the business's tone.
- Do not fabricate awards, testimonials, or phone numbers. Use only the contact facts in the user message.
- Use only the real image URLs in the user message, copied exactly. If the user message lists none, use typography, color, and inline SVG. Do not invent an image URL.
- Include a way to see who they are, what they offer, the real contact info, and a clear next action.
- The footer includes this exact text: Website sample by Wild Card Creative Co
- The head includes this exact tag: <meta name="robots" content="noindex, nofollow">
- Any copyright, footer date, or year is __CURRENT_YEAR__. Do not write a past year.
- The response is the raw HTML document. Respond directly without preamble. Do not start with phrases like "Here is...", "Based on...", or a markdown fence.`,
  "claude-sonnet-5": `The user message is a concrete visual spec for this one business. Follow that spec for every section of the page, not only the first screen. Do not replace it with a different palette, typeface, or layout.

<frontend_aesthetics>
NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white or dark backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character. Use unique fonts, cohesive colors and themes, and animations for effects and micro-interactions.
</frontend_aesthetics>

Do not use a checkered or gingham border, a repeating diagonal stripe as a divider, a grain overlay, or a custom cursor. If the page spec does not name a border, a divider, or a cursor, use a plain cursor and no decorative border or divider.

Do not write your reasoning in the response.

Write one complete HTML document for a local business website sample.

Hard rules:
- One file. Put all CSS in one <style> block. You may add one Google Fonts <link> for the typeface named in the user message. Inline SVG is allowed. No build step and no external JavaScript framework.
- Mobile-first, readable contrast, semantic HTML.
- Use the research brief for the words a visitor reads. Carry over real services and the business's tone.
- Do not fabricate awards, testimonials, or phone numbers. Use only the contact facts in the user message.
- Use only the real image URLs in the user message, copied exactly. If the user message lists none, use typography, color, and inline SVG. Do not invent an image URL.
- Include a way to see who they are, what they offer, the real contact info, and a clear next action.
- The footer includes this exact text: Website sample by Wild Card Creative Co
- The head includes this exact tag: <meta name="robots" content="noindex, nofollow">
- Any copyright, footer date, or year is __CURRENT_YEAR__. Do not write a past year.
- The response is the raw HTML document. Respond directly without preamble. Do not start with phrases like "Here is...", "Based on...", or a markdown fence.`,
  "claude-haiku-4-5": `You are writing one HTML document. Follow the visual reference in the user message for every section of the page.

Do not use a checkered or gingham border, a repeating diagonal stripe as a divider, a grain overlay, or a custom cursor. If the page spec does not name a border, a divider, or a cursor, use a plain cursor and no decorative border or divider.

Do not write your reasoning in the response.

Write one complete HTML document for a local business website sample.

Hard rules:
- One file. Put all CSS in one <style> block. You may add one Google Fonts <link> for the typeface named in the user message. Inline SVG is allowed. No build step and no external JavaScript framework.
- Mobile-first, readable contrast, semantic HTML.
- Use the research brief for the words a visitor reads. Carry over real services and the business's tone.
- Do not fabricate awards, testimonials, or phone numbers. Use only the contact facts in the user message.
- Use only the real image URLs in the user message, copied exactly. If the user message lists none, use typography, color, and inline SVG. Do not invent an image URL.
- Include a way to see who they are, what they offer, the real contact info, and a clear next action.
- The footer includes this exact text: Website sample by Wild Card Creative Co
- The head includes this exact tag: <meta name="robots" content="noindex, nofollow">
- Any copyright, footer date, or year is __CURRENT_YEAR__. Do not write a past year.
- The response is the raw HTML document. Respond directly without preamble. Do not start with phrases like "Here is...", "Based on...", or a markdown fence.`,
  "claude-fable-5": `I'm working on a website sample for a sales conversation with this local business. They need the page to look like their trade and their town. With that in mind: follow the visual reference in the user message for the whole page.

Do not use a checkered or gingham border, a repeating diagonal stripe as a divider, a grain overlay, or a custom cursor. If the page spec does not name a border, a divider, or a cursor, use a plain cursor and no decorative border or divider.

Don't add features, refactor, or introduce abstractions beyond what the task requires. A one-shot operation usually doesn't need a helper. Don't design for hypothetical future requirements: do the simplest thing that works well.

Do not write your reasoning in the response.

Write one complete HTML document for a local business website sample.

Hard rules:
- One file. Put all CSS in one <style> block. You may add one Google Fonts <link> for the typeface named in the user message. Inline SVG is allowed. No build step and no external JavaScript framework.
- Mobile-first, readable contrast, semantic HTML.
- Use the research brief for the words a visitor reads. Carry over real services and the business's tone.
- Do not fabricate awards, testimonials, or phone numbers. Use only the contact facts in the user message.
- Use only the real image URLs in the user message, copied exactly. If the user message lists none, use typography, color, and inline SVG. Do not invent an image URL.
- Include a way to see who they are, what they offer, the real contact info, and a clear next action.
- The footer includes this exact text: Website sample by Wild Card Creative Co
- The head includes this exact tag: <meta name="robots" content="noindex, nofollow">
- Any copyright, footer date, or year is __CURRENT_YEAR__. Do not write a past year.
- The response is the raw HTML document. Respond directly without preamble. Do not start with phrases like "Here is...", "Based on...", or a markdown fence.`,
  "claude-opus-4-6": `Follow the visual reference in the user message for every section of the page.

<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this
creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive
frontends that surprise and delight.

Focus on:
- Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic
fonts like Arial and Inter; opt instead for distinctive choices that elevate the
frontend's aesthetics.
- Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency.
Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw
from IDE themes and cultural aesthetics for inspiration.
- Motion: Use animations for effects and micro-interactions. Prioritize CSS-only
solutions for HTML. Use Motion library for React when available. Focus on high-impact
moments: one well-orchestrated page load with staggered reveals (animation-delay)
creates more delight than scattered micro-interactions.
- Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer
CSS gradients, use geometric patterns, or add contextual effects that match the overall
aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the
context. Vary between light and dark themes, different fonts, different aesthetics. You
still tend to converge on common choices (Space Grotesk, for example) across
generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>

Do not use a checkered or gingham border, a repeating diagonal stripe as a divider, a grain overlay, or a custom cursor. If the page spec does not name a border, a divider, or a cursor, use a plain cursor and no decorative border or divider. A geometric pattern in the note above is not a checkered or gingham border and not a repeating diagonal stripe.

Do not write your reasoning in the response.

Write one complete HTML document for a local business website sample.

Hard rules:
- One file. Put all CSS in one <style> block. You may add one Google Fonts <link> for the typeface named in the user message. Inline SVG is allowed. No build step and no external JavaScript framework.
- Mobile-first, readable contrast, semantic HTML.
- Use the research brief for the words a visitor reads. Carry over real services and the business's tone.
- Do not fabricate awards, testimonials, or phone numbers. Use only the contact facts in the user message.
- Use only the real image URLs in the user message, copied exactly. If the user message lists none, use typography, color, and inline SVG. Do not invent an image URL.
- Include a way to see who they are, what they offer, the real contact info, and a clear next action.
- The footer includes this exact text: Website sample by Wild Card Creative Co
- The head includes this exact tag: <meta name="robots" content="noindex, nofollow">
- Any copyright, footer date, or year is __CURRENT_YEAR__. Do not write a past year.
- The response is the raw HTML document. Respond directly without preamble. Do not start with phrases like "Here is...", "Based on...", or a markdown fence.`
};

const DEFAULT_HTML_MODEL = "claude-opus-5-5";

function htmlModelId(d, dollar) {
  var fromTrigger = "";
  try {
    var trig = dollar("When Called by WF-1").first().json || {};
    fromTrigger = trig.model || "";
  } catch (e) {}
  var raw = String(fromTrigger || (d && d.model) || DEFAULT_HTML_MODEL).trim();
  if (SYSTEM_PROMPTS[raw]) return raw;
  return DEFAULT_HTML_MODEL;
}

function systemPrompt(modelId, year) {
  var body = SYSTEM_PROMPTS[modelId] || SYSTEM_PROMPTS[DEFAULT_HTML_MODEL];
  return body.split("__CURRENT_YEAR__").join(String(year));
}

function vagueReferenceName(name) {
  return /^(modern( and clean)?|clean|minimal(ist)?|professional|elegant|bold|contemporary)$/i.test(String(name || "").trim());
}

function referenceFromItem(d) {
  var ref = d && d._visual_reference;
  if (ref && typeof ref === "object") {
    var name = vagueReferenceName(ref.reference_name) ? "" : String(ref.reference_name || "").trim();
    var tied = String(ref.tied_to || "").trim();
    var spec = String(ref.page_spec || "").trim();
    if (name || tied || spec) {
      return {
        reference_name: name.slice(0, 240),
        tied_to: tied.slice(0, 500),
        page_spec: spec.slice(0, 4000)
      };
    }
  }
  var brief = (d && d._brief) || {};
  var briefName = String(brief.design_direction || "").trim();
  if (vagueReferenceName(briefName) || /modern and clean/i.test(briefName)) briefName = "";
  var specParts = [brief.palette_mood, brief.type_character, brief.signature_layout_move].filter(Boolean);
  return {
    reference_name: briefName.slice(0, 240),
    tied_to: [d && d.category, brief.location_context || (d && d.address) || ""].filter(Boolean).join(" — ").slice(0, 500),
    page_spec: specParts.join("\n").slice(0, 4000)
  };
}

function writeHtmlUserPrompt(d, reference) {
  var brief = (d && d._brief) || {};
  var images = (d && d._site_images) || [];
  var site = String((d && d._site_html) || "").slice(0, 10000);
  var ref = reference || {};
  var name = ref.reference_name || ref.tied_to || "this business's trade and town, named from the facts below";
  var lines = [];
  lines.push("This sample is one HTML page for a sales conversation with this business. They need the page to look like their trade and their town.");
  lines.push("Follow the visual reference below for every section, not only the first screen. When the research brief disagrees with the reference about the look, follow the reference.");
  lines.push("");
  lines.push("Visual reference (this is the design):");
  lines.push("Name: " + name);
  if (ref.tied_to) lines.push("Tied to this business: " + ref.tied_to);
  lines.push("Page spec:");
  lines.push(ref.page_spec || "Take the background, type, layout, and colors from this trade and this town. Do not describe the look as modern and clean.");
  lines.push("");
  lines.push("Do not use a checkered or gingham border, a repeating diagonal stripe as a divider, a grain overlay, or a custom cursor anywhere on the page.");
  lines.push("");
  lines.push("Research brief (facts, services, and the words a visitor reads):");
  lines.push(JSON.stringify(brief, null, 2));
  lines.push("");
  lines.push("Business contact facts (the only name, phone number, and address you may print):");
  lines.push(JSON.stringify({
    name: d.business_name,
    category: d.category,
    phone: d.phone,
    address: d.address,
    website: d.website,
    rating: d.rating,
    review_count: d.review_count
  }, null, 2));
  lines.push("");
  if (images.length) {
    lines.push("Real image URLs. Use these exact strings, or use no images:");
    lines.push(images.join("\n"));
  } else {
    lines.push("No real image URLs were provided. Do not invent an image URL.");
  }
  if (site) {
    lines.push("");
    lines.push("Existing site HTML (source of real facts only. Do not copy its layout or design):");
    lines.push(site);
  }
  return lines.join("\n");
}

const d = $input.first().json;
const currentYear = new Date().getFullYear();
const hasFeedback = d._feedback && d._version > 0;

var currentMockup = "";
try {
  var fc = $("Fetch Current Mockup HTML").first().json;
  if (fc && fc.content) currentMockup = Buffer.from(fc.content, "base64").toString("utf8");
} catch (e) {}

const isRevision = hasFeedback && currentMockup && currentMockup.length > 200;
const modelId = htmlModelId(d, $);
var requestedModel = "";
try {
  var trig = $("When Called by WF-1").first().json || {};
  requestedModel = String(trig.model || d.model || "").trim();
} catch (e2) {
  requestedModel = String(d.model || "").trim();
}
var system;
var user;

if (isRevision) {
  system = [
    "You are a web developer revising an EXISTING single-file HTML website based on specific feedback.",
    "RULES:",
    "- Start from the CURRENT HTML provided below. This is an edit, not a rewrite.",
    "- Preserve everything not mentioned in the feedback: existing copy, images, layout, sections, styling, design direction.",
    "- Apply the requested feedback precisely. If it references images, move/resize/reposition the actual <img> tags and their existing src URLs — do not remove images or invent new ones unless asked.",
    "- Do NOT fabricate awards, testimonials, or phone numbers. Use provided contact facts only.",
    "- Keep <meta name=\"robots\" content=\"noindex, nofollow\"> in the <head> exactly as it is. Never remove or change it.",
    "- Use the CURRENT YEAR (" + currentYear + ") in any copyright/footer/date. Never use a past year.",
    "- Output ONLY the raw complete HTML document. No markdown fences, no preamble, no explanation of what you changed — every extra sentence costs tokens."
  ].join("\n");
  user = "Feedback to apply (revision #" + d._version + "):\n" + d._feedback;
  user += "\n\nBusiness contact facts (for reference, do not change unless feedback asks):\n" + JSON.stringify({ name: d.business_name, category: d.category, phone: d.phone, address: d.address }, null, 2);
  user += "\n\nCURRENT HTML (edit this in place):\n" + currentMockup;
} else {
  system = systemPrompt(modelId, currentYear);
  user = writeHtmlUserPrompt(d, referenceFromItem(d));
}

return [{ json: Object.assign({}, d, {
  _system: system,
  _user: user,
  _html_model: modelId,
  _html_model_fallback: requestedModel !== "" && requestedModel !== modelId
}) }];
