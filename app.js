// ─── State ───────────────────────────────────────────────────────────────────
let lastVerdict = '';
let lastReason = '';
let lastConfidence = '';
let lastSearchContext = '';
let lastBookTitle = '';
let lastBookAuthor = '';
let lastBlurbText = '';
let imageBase64 = '';
let imageMediaType = '';

// ─── Init ────────────────────────────────────────────────────────────────────
const GMAIL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz5nZ6vA_41kKSoSKxc90of48ek42pChIYgt0_Vgon8nD_IeFcu1Twu6OPymPZwYmnl/exec';

document.addEventListener('DOMContentLoaded', () => {
  showScreen(1);
  bindEvents();
});

// ─── Screen management ───────────────────────────────────────────────────────
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + screenId);
  if (target) target.classList.add('active');
}

// ─── Event binding ───────────────────────────────────────────────────────────
function bindEvents() {
  // Camera button → trigger camera-capture file input
  document.getElementById('camera-btn').addEventListener('click', () => {
    document.getElementById('book-image').click();
  });

  // Upload button → trigger gallery file input
  document.getElementById('upload-btn').addEventListener('click', () => {
    document.getElementById('book-image-upload').click();
  });

  // File selected (camera)
  document.getElementById('book-image').addEventListener('change', (e) => {
    handleFileSelected(e.target.files[0]);
  });

  // File selected (upload)
  document.getElementById('book-image-upload').addEventListener('change', (e) => {
    handleFileSelected(e.target.files[0]);
  });

  // Remove image
  document.getElementById('remove-image-btn').addEventListener('click', clearImage);

  // Blurb text → enable/disable submit
  document.getElementById('book-blurb').addEventListener('input', updateSubmitState);

  // Form submit
  document.getElementById('book-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit();
  });

  // Feedback send — screen 3 (GOOD)
  document.getElementById('send-feedback-btn').addEventListener('click', () => {
    sendFeedback('feedback-text', 'feedback-confirmation-3');
  });

  // Feedback send — screen 4 (NOT YET)
  document.getElementById('send-feedback-btn-4').addEventListener('click', () => {
    sendFeedback('feedback-text-4', 'feedback-confirmation-4');
  });

  // Check another book
  document.getElementById('check-another-btn').addEventListener('click', resetApp);

  // WHY buttons (good and bad result screens)
  document.getElementById('why-btn-good').addEventListener('click', () => {
    showWhyScreen('GOOD');
  });

  document.getElementById('why-btn-bad').addEventListener('click', () => {
    showWhyScreen('NOT_YET');
  });

  // Ask Mama button (WHY screen)
  document.getElementById('ask-mama-btn').addEventListener('click', () => {
    showAskMamaScreen();
  });

  // Send To Mama button (Ask Mama screen)
  document.getElementById('send-mama-btn').addEventListener('click', () => {
    sendMamaMessage();
  });
}

// ─── Image handling ───────────────────────────────────────────────────────────
async function convertHeicToJpeg(file) {
  console.log('HEIC conversion: file.type =', file.type, '| file.name =', file.name, '| heic2any loaded =', typeof heic2any !== 'undefined');

  // Force correct MIME type — Chrome often reports HEIC as empty string
  const heicBlob = new Blob([await file.arrayBuffer()], { type: 'image/heic' });

  // Method 1: heic2any (Chrome/Firefox via WebAssembly)
  if (typeof heic2any !== 'undefined') {
    try {
      console.log('HEIC: trying heic2any...');
      const result = await heic2any({ blob: heicBlob, toType: 'image/jpeg', quality: 0.85 });
      console.log('HEIC: heic2any succeeded');
      return Array.isArray(result) ? result[0] : result;
    } catch (e) {
      console.warn('HEIC: heic2any failed:', e.message || e);
    }
  } else {
    console.warn('HEIC: heic2any not loaded');
  }

  // Method 2: Canvas via native <img> decode (Safari supports HEIC natively)
  console.log('HEIC: trying canvas fallback...');
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(heicBlob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      console.log('HEIC: image loaded, drawing to canvas...');
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (blob) { console.log('HEIC: canvas succeeded'); resolve(blob); }
        else reject(new Error('canvas toBlob returned null'));
      }, 'image/jpeg', 0.85);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      console.warn('HEIC: canvas fallback — image failed to load (browser cannot decode HEIC):', e);
      reject(new Error('Browser cannot decode HEIC natively'));
    };
    img.src = url;
  });
}

async function handleFileSelected(file) {
  if (!file) return;

  const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

  if (isHeic) {
    try {
      file = await convertHeicToJpeg(file);
    } catch (err) {
      console.error('HEIC conversion failed (all methods):', err);
      alert("Hmm, couldn't convert that iPhone photo 🌸 Try screenshotting the book cover instead!");
      return;
    }
  }

  // Downscale + compress BEFORE upload — a 4MB cover becomes ~100-200KB,
  // which is the single biggest speed-up for the round-trip on mobile.
  try {
    const out = await downscaleImage(file, 1100, 0.82);
    imageMediaType = out.mediaType;
    imageBase64 = out.base64;
    showPreview(out.dataUrl);
    updateSubmitState();
    return;
  } catch (e) {
    console.warn('Image downscale failed, sending original:', e?.message || e);
  }

  // Fallback: original full-size image via FileReader
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      imageMediaType = matches[1];
      imageBase64 = matches[2];
    } else {
      imageBase64 = dataUrl;
      imageMediaType = file.type || 'image/jpeg';
    }
    showPreview(dataUrl);
    updateSubmitState();
  };
  reader.readAsDataURL(file);
}

// Draw the photo to a canvas at a capped max dimension and re-encode as JPEG.
// Returns { dataUrl, base64, mediaType }.
function downscaleImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) return reject(new Error('image has no dimensions'));
      const scale = Math.min(1, maxDim / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return reject(new Error('canvas produced no data URL'));
      console.log(`📷 Downscaled ${w}x${h} → ${cw}x${ch}, ~${Math.round(m[2].length * 0.75 / 1024)}KB`);
      resolve({ dataUrl, mediaType: m[1], base64: m[2] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image failed to load')); };
    img.src = url;
  });
}

function showPreview(dataUrl) {
  document.getElementById('image-preview').src = dataUrl;
  document.getElementById('image-preview-wrap').classList.add('has-image');
}

function clearImage() {
  imageBase64 = '';
  imageMediaType = '';
  document.getElementById('image-preview').src = '';
  document.getElementById('image-preview-wrap').classList.remove('has-image');
  // Reset file inputs so same file can be re-selected
  document.getElementById('book-image').value = '';
  document.getElementById('book-image-upload').value = '';
  updateSubmitState();
}

function updateSubmitState() {
  const hasImage = !!imageBase64;
  const hasText = document.getElementById('book-blurb').value.trim().length > 0;
  document.getElementById('submit-btn').disabled = !(hasImage || hasText);
}

// ─── Submit / API call ────────────────────────────────────────────────────────
async function handleSubmit() {
  // Guard: API key not configured
  if (CONFIG.GOOGLE_API_KEY.startsWith('YOUR_')) {
    alert("Book Butterfly needs setup — ask Mama to add the magic key! 🔑");
    return;
  }

  lastBlurbText = document.getElementById('book-blurb').value.trim();

  showScreen(2);

  try {
    // Call A: identify the book AND research it in ONE grounded call.
    // (Was two sequential calls — merging removes a full network round-trip,
    //  and the image is uploaded here only once.)
    console.log('📚 CALL A: identify + research...');
    const research = await identifyAndResearch();
    if (research) {
      lastBookTitle = research.title || '';
      lastBookAuthor = research.author || '';
      lastSearchContext = research.context || '';
    }
    console.log('📚 CALL A result — title:', lastBookTitle || '(none)', '| context:', lastSearchContext ? 'YES' : 'NO');

    // Call B: verdict. Skip re-uploading the image when we already have
    // research context (saves a second large upload); only attach the cover
    // as a fallback when research came back empty.
    const haveContext = !!lastSearchContext;
    console.log('📚 CALL B: verdict, attachImage =', !haveContext);
    const result = await callGeminiAPI(lastSearchContext, !haveContext);
    lastVerdict = result.verdict;
    lastReason = result.reason;
    lastConfidence = result.confidence || 'HIGH';

    // Low confidence → override to NOT_YET
    if (lastConfidence === 'LOW') {
      lastVerdict = 'NOT_YET';
      lastReason = "I'm not totally sure about this one! Better check with an adult first. 🦋";
    }
  } catch (err) {
    console.error('API error:', err?.message || err);
    lastVerdict = 'NOT_YET';
    lastReason = "I couldn't read this book right now. Check with an adult before reading! 🦋";
  }

  displayResult();
}

// ─── Call A: Identify the book AND research it in one grounded request ───────
// Replaces the old two-step (extract title → search). One round-trip, image
// uploaded once. Returns { title, author, context } or null on failure.
async function identifyAndResearch() {
  const parts = [];
  if (imageBase64 && imageMediaType) {
    parts.push({ inline_data: { mime_type: imageMediaType, data: imageBase64 } });
  }

  let q = 'Identify this book';
  if (imageBase64) q += ' from the cover photo';
  if (lastBlurbText) q += ', using this back-cover text as a hint:\n' + lastBlurbText;
  q += `.\nThen use Google Search to find: the Common Sense Media age rating, recommended age range, main themes, whether it is educational/STEM, and any content warnings (violence, scary or traumatic themes, death, romance, bullying, school/friendship drama, puberty, LGBTQ+ topics).

Respond in EXACTLY this format:
TITLE: <book title, or unknown>
AUTHOR: <author, or unknown>
RESEARCH: <2-4 factual sentences with any age ratings and content flags you found>`;
  parts.push({ text: q });

  const body = {
    tools: [{ google_search: {} }],
    contents: [{ parts }],
    generationConfig: { maxOutputTokens: 700 }
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${CONFIG.GOOGLE_API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    console.warn('📚 CALL A failed:', res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(' ').trim();
  console.log('📚 CALL A raw:', text.slice(0, 300));
  if (!text) return null;

  const clean = (s) => (s || '').trim().replace(/^unknown$/i, '');
  const title = clean(text.match(/TITLE:\s*(.+)/i)?.[1]);
  const author = clean(text.match(/AUTHOR:\s*(.+)/i)?.[1]);
  // Everything after RESEARCH: is the context; fall back to the whole reply.
  const context = (text.match(/RESEARCH:\s*([\s\S]+)/i)?.[1] || text).trim();
  return { title, author, context };
}

// ─── Call B: Make the verdict using all available context ────────────────────
async function callGeminiAPI(bookMetadata, attachImage) {
  const rules = `You are Book Butterfly, a friendly helper that decides if books are right for 7-year-old children.

Evaluate based on these rules:
- NO crime, violence, or disturbing content
- NO sexual topics, sexual health, or adult relationships
- NO gender identity, transgender, or LGBTQ+ themes
- NO puberty, periods, or body change topics
- NO scary or traumatic themes
- NO heavy death themes (light fairy-tale death is okay)
- NO suffering, pain, or emotional distress as central themes
- NO school drama, social cliques, or popularity contests
- NO best friend conflict or friendship betrayal storylines
- NO boyfriend/girlfriend relationships or romantic drama
- NO bullying as a theme (even if the bully "learns a lesson")
- Age-appropriate vocabulary and themes for a 7-year-old

GREAT books include any of these:
- Science, nature, experiments, and how things work
- Science fiction, robots, space, technology, and invention
- STEM skills: coding, engineering, math puzzles, building
- Creative arts: drawing, crafts, painting, making things
- Adventure, magic, fantasy, and imaginative worlds
- Animals, nature, and exploring the outdoors
- Feel-good stories about kindness, curiosity, and discovery
- Stories about girl power, strong female characters, and women who achieve great things
- Books that celebrate being a girl as something special and wonderful
- Stories about confidence, bravery, and believing in yourself

You MUST respond with ONLY valid JSON in this exact format:
{
  "verdict": "GOOD" or "NOT_YET",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "reason": "One friendly sentence explaining why, written directly to a 7-year-old girl. Use simple words. Be warm and encouraging even for NOT_YET."
}

Set confidence to:
- HIGH: you found clear information and are certain of the verdict
- MEDIUM: you have some information but are making an educated guess
- LOW: you could not find enough information to be sure

If you cannot determine from the image/text, respond with verdict "NOT_YET", confidence "LOW" and reason "I'm not sure about this one! Check with an adult before reading. 🦋"`;

  const parts = [];
  if (attachImage && imageBase64 && imageMediaType) {
    parts.push({ inline_data: { mime_type: imageMediaType, data: imageBase64 } });
  }

  let userText = 'Please evaluate this book for me!';
  if (lastBlurbText) userText += '\n\nBack cover text:\n' + lastBlurbText;
  if (bookMetadata) {
    userText += '\n\nHere is what Google says about this book:\n' + bookMetadata;
  }
  parts.push({ text: userText });

  const requestBody = {
    system_instruction: { parts: [{ text: rules }] },
    contents: [{ parts }],
    // Verdict is a short JSON blob — a small token budget returns faster.
    generationConfig: { maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${CONFIG.GOOGLE_API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody) }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('API request failed: ' + response.status + ' ' + errText);
  }

  const data = await response.json();
  console.log('Gemini verdict response:', JSON.stringify(data).slice(0, 500));
  if (!data.candidates?.[0]) {
    throw new Error('Gemini returned no candidates. Response: ' + JSON.stringify(data).slice(0, 300));
  }
  const rawText = data.candidates[0].content.parts[0].text.trim();

  let parsed;
  try {
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    console.warn('JSON parse failed. Raw:', rawText);
    parsed = { verdict: 'NOT_YET', reason: "I'm not sure about this one! Check with an adult before reading. 🦋" };
  }

  if (!['GOOD', 'NOT_YET'].includes(parsed.verdict)) parsed.verdict = 'NOT_YET';
  return parsed;
}

// ─── Display result ───────────────────────────────────────────────────────────
function displayResult() {
  if (lastVerdict === 'GOOD') {
    document.getElementById('result-reason-good').textContent = lastReason;
    showScreen(3);
  } else {
    document.getElementById('result-reason-notyet').textContent = lastReason;
    showScreen(4);
  }
}

// ─── Feedback / EmailJS ───────────────────────────────────────────────────────
async function sendFeedback(textareaId, confirmationId) {
  const textarea = document.getElementById(textareaId);
  const feedbackText = textarea.value.trim();
  const btnId = textareaId === 'feedback-text' ? 'send-feedback-btn' : 'send-feedback-btn-4';
  const btn = document.getElementById(btnId);

  // Disable button while sending to prevent double-taps
  btn.disabled = true;

  try {
    const payload = new URLSearchParams();
    payload.append('book_title', lastBookTitle || lastBlurbText || '(unknown)');
    payload.append('book_author', lastBookAuthor || '');
    payload.append('verdict', lastVerdict);
    payload.append('confidence', lastConfidence);
    payload.append('butterfly_reason', lastReason);
    payload.append('search_context', lastSearchContext);
    payload.append('child_feedback', feedbackText || '(no message)');
    payload.append('blurb', lastBlurbText || '(image only)');
    console.log('[BookButterfly] Sending to Apps Script:', Object.fromEntries(payload));
    console.log('[BookButterfly] URL:', GMAIL_SCRIPT_URL);
    const resp = await fetch(GMAIL_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: payload
    });
    console.log('[BookButterfly] Fetch completed, response type:', resp.type);
  } catch (err) {
    console.error('[BookButterfly] Gmail send error:', err);
  }

  // Always show confirmation and go to celebration screen
  const confirmation = document.getElementById(confirmationId);
  if (confirmation) confirmation.hidden = false;

  setTimeout(() => showScreen(5), 1200);
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetApp() {
  // Clear state
  lastVerdict = '';
  lastReason = '';
  lastConfidence = '';
  lastSearchContext = '';
  lastBookTitle = '';
  lastBookAuthor = '';
  lastBlurbText = '';

  // Clear inputs (clearImage also resets imageBase64 + imageMediaType)
  document.getElementById('book-blurb').value = '';
  clearImage();

  // Reset feedback textareas, buttons, and confirmations
  document.getElementById('feedback-text').value = '';
  document.getElementById('feedback-text-4').value = '';
  document.getElementById('feedback-confirmation-3').hidden = true;
  document.getElementById('feedback-confirmation-4').hidden = true;
  document.getElementById('send-feedback-btn').disabled = false;
  document.getElementById('send-feedback-btn-4').disabled = false;

  // Re-disable submit
  document.getElementById('submit-btn').disabled = true;

  // Reset WHY / Ask Mama screens
  const whyQ = document.getElementById('why-child-question');
  const whyA = document.getElementById('why-butterfly-answer');
  if (whyQ) whyQ.textContent = '';
  if (whyA) whyA.textContent = '';

  const mamaTextarea = document.getElementById('feedback-text-mama');
  if (mamaTextarea) mamaTextarea.value = '';

  showScreen(1);
}

// ─── WHY screen ───────────────────────────────────────────────────────────────
function showWhyScreen(verdict) {
  const verdictLabel = verdict === 'GOOD' ? 'good' : 'bad';
  const childQuestion = `Why is this book ${verdictLabel}?`;
  document.getElementById('why-child-question').textContent = childQuestion;
  document.getElementById('why-butterfly-answer').textContent = lastReason || '(no reason yet)';
  showScreen(6);
}

// ─── Ask Mama screen ──────────────────────────────────────────────────────────
function showAskMamaScreen() {
  const verdictLabel = lastVerdict === 'GOOD' ? 'good' : 'not right for me';
  const prefill = `Book Butterfly says this book is ${verdictLabel} because ${lastReason || '(no reason given)'}. But I think...`;
  const mamaTextarea = document.getElementById('feedback-text-mama');
  if (mamaTextarea) mamaTextarea.value = prefill;
  showScreen(7);
}

// ─── Send To Mama (from Ask Mama screen) ──────────────────────────────────────
async function sendMamaMessage() {
  const btn = document.getElementById('send-mama-btn');
  const textarea = document.getElementById('feedback-text-mama');
  const feedbackText = textarea ? textarea.value.trim() : '';

  btn.disabled = true;

  try {
    const payload = new URLSearchParams();
    payload.append('book_title', lastBookTitle || lastBlurbText || '(unknown)');
    payload.append('book_author', lastBookAuthor || '');
    payload.append('verdict', lastVerdict);
    payload.append('confidence', lastConfidence);
    payload.append('butterfly_reason', lastReason);
    payload.append('search_context', lastSearchContext);
    payload.append('child_feedback', feedbackText || '(no message)');
    payload.append('blurb', lastBlurbText || '(image only)');
    console.log('[BookButterfly] sendMamaMessage payload:', Object.fromEntries(payload));
    const resp = await fetch(GMAIL_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: payload
    });
    console.log('[BookButterfly] sendMamaMessage fetch done, type:', resp.type);
  } catch (err) {
    console.error('[BookButterfly] sendMamaMessage error:', err);
  }

  showScreen(5);
}
