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

    const previewImg = document.getElementById('image-preview');
    previewImg.src = dataUrl;
    document.getElementById('image-preview-wrap').classList.add('has-image');

    updateSubmitState();
  };
  reader.readAsDataURL(file);
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
    // Step 1: extract title + author from image/blurb
    console.log('📚 STEP 1: Extracting book title...');
    const titleInfo = await extractBookTitle();
    console.log('📚 STEP 1 result:', JSON.stringify(titleInfo));
    lastBookTitle = titleInfo?.title || '';
    lastBookAuthor = titleInfo?.author || '';

    // Step 2: search Google + Common Sense Media for book info
    let bookMetadata = null;
    if (titleInfo && titleInfo.title) {
      console.log('📚 STEP 2: Searching Google/CSM for:', titleInfo.title, 'by', titleInfo.author);
      bookMetadata = await searchBookInfo(titleInfo.title, titleInfo.author);
      lastSearchContext = bookMetadata || '';
      console.log('📚 STEP 2 result:', bookMetadata ? bookMetadata.slice(0, 200) : 'null');
    } else {
      console.warn('📚 STEP 2: Skipped — no title extracted');
    }

    // Step 3: make verdict using all available data
    console.log('📚 STEP 3: Calling Gemini for verdict, search context:', bookMetadata ? 'YES' : 'NO');
    const result = await callGeminiAPI(bookMetadata);
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

// ─── Step 1: Extract book title + author from image/blurb ────────────────────
async function extractBookTitle() {
  const parts = [];
  if (imageBase64 && imageMediaType) {
    parts.push({ inline_data: { mime_type: imageMediaType, data: imageBase64 } });
  }
  parts.push({ text: 'What is the title and author of this book? Reply with ONLY valid JSON: {"title": "...", "author": "..."} — if you cannot tell, use null for both fields.' });

  const body = {
    contents: [{ parts }],
    generationConfig: { maxOutputTokens: 100, thinkingConfig: { thinkingBudget: 0 } }
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${CONFIG.GOOGLE_API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) { console.warn('📚 STEP 1 Gemini call failed:', res.status); return null; }
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  console.log('📚 STEP 1 raw Gemini response:', raw);
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (e) { console.warn('📚 STEP 1 JSON parse failed:', e.message, '| raw:', raw); return null; }
}

// ─── Step 2: Search Google for book info using Gemini grounding ──────────────
async function searchBookInfo(title, author) {
  const bookRef = author ? `"${title}" by ${author}` : `"${title}"`;
  const question = `Search for the children's book ${bookRef}. I need:
1. The Common Sense Media age rating and review if available
2. Recommended age range from any source
3. Main themes and topics in the book
4. Any content warnings (violence, scary themes, romance, death, bullying, school drama, etc.)
5. Whether it is considered educational or STEM-related
Be specific and factual. Include any age ratings or content flags you find.`;

  const body = {
    tools: [{ google_search: {} }],
    contents: [{ parts: [{ text: question }] }],
    generationConfig: { maxOutputTokens: 600 }
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${CONFIG.GOOGLE_API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) {
    console.warn('📚 STEP 2 search failed:', res.status, await res.text());
    return null;
  }

  const data = await res.json();
  console.log('📚 STEP 2 raw search response:', JSON.stringify(data).slice(0, 500));

  // Extract text from response — may be across multiple parts
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || '').join(' ').trim();
  return text || null;
}

// ─── Step 3: Make verdict using all available context ────────────────────────
async function callGeminiAPI(bookMetadata) {
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
  if (imageBase64 && imageMediaType) {
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
    generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } }
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
    await fetch(GMAIL_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: payload
    });
  } catch (err) {
    console.error('Gmail send error:', err);
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
    await fetch(GMAIL_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: payload
    });
  } catch (err) {
    console.error('Gmail send error:', err);
  }

  showScreen(5);
}
