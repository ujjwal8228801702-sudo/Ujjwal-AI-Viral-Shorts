export const maxDuration = 60;

function decodeEntities(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function timeLabel(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return '[' + String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0') + ']';
}

function getVideoId(value) {
  let parsed;
  try { parsed = new URL(value); } catch { return null; }
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || null;
  if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
    if (parsed.pathname === '/watch') return parsed.searchParams.get('v');
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (['shorts', 'embed', 'live'].includes(parts[0])) return parts[1] || null;
  }
  return null;
}

function extractPlayerResponse(html) {
  const markers = ['ytInitialPlayerResponse =', '"ytInitialPlayerResponse":'];
  for (const marker of markers) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex < 0) continue;
    const start = html.indexOf('{', markerIndex + marker.length);
    if (start < 0) continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < html.length; i++) {
      const ch = html[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(html.slice(start, i + 1)); } catch { break; }
        }
      }
    }
  }
  return null;
}

async function fetchTranscript(videoId) {
  const watchUrl = 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId);
  let pageResponse;
  try {
    pageResponse = await fetch(watchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    throw new Error('YouTube से संपर्क करने में समय लग गया। कृपया दोबारा कोशिश करें।');
  }
  if (!pageResponse.ok) throw new Error('YouTube वीडियो की जानकारी नहीं मिल सकी।');
  const html = await pageResponse.text();
  const player = extractPlayerResponse(html);
  if (!player) throw new Error('YouTube captions की जानकारी नहीं पढ़ी जा सकी।');
  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (!tracks.length) throw new Error('इस वीडियो के captions ऐप को उपलब्ध नहीं हुए।');
  const track = tracks.find(t => /^hi(-|$)/i.test(t.languageCode || ''))
    || tracks.find(t => /^en(-|$)/i.test(t.languageCode || ''))
    || tracks[0];
  const captionUrl = new URL(track.baseUrl);
  captionUrl.searchParams.set('fmt', 'json3');
  let captionResponse;
  try {
    captionResponse = await fetch(captionUrl.toString(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    throw new Error('YouTube captions डाउनलोड करने में समय लग गया।');
  }
  if (!captionResponse.ok) throw new Error('YouTube captions डाउनलोड नहीं हो पाए।');
  const raw = await captionResponse.text();
  let lines = [];
  try {
    const data = JSON.parse(raw);
    lines = (data.events || []).flatMap(event => {
      const line = (event.segs || []).map(seg => seg.utf8 || '').join('').trim();
      return line ? [timeLabel((event.tStartMs || 0) / 1000) + ' ' + line] : [];
    });
  } catch {
    lines = [...raw.matchAll(/<text[^>]*start="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g)]
      .map(m => timeLabel(Number(m[1])) + ' ' + decodeEntities(m[2].replace(/<[^>]+>/g, ' ')));
  }
  const transcript = lines.join('\n').trim();
  if (transcript.length < 80) throw new Error('Captions बहुत कम मिले या पढ़े नहीं जा सके।');
  return { transcript: transcript.slice(0, 60000), language: track.languageCode || 'unknown' };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) return Response.json({ error: 'पहले YouTube वीडियो का लिंक डालें।' }, { status: 400 });
    const videoId = getVideoId(url);
    if (!videoId) return Response.json({ error: 'सही YouTube वीडियो लिंक डालें।' }, { status: 400 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: 'Gemini API key Vercel में सेट नहीं है।' }, { status: 503 });

    const captionData = await fetchTranscript(videoId);
    const prompt = 'आप हिंदी Shorts content planner हैं। नीचे दिए गए वास्तविक YouTube captions का विश्लेषण करें। केवल captions में मौजूद तथ्यों का उपयोग करें; कुछ गढ़ें नहीं। 3 से 5 engaging Shorts moments दें। timestamps captions के आधार पर चुनें; प्रत्येक clip लगभग 30-60 सेकंड का हो। हर highlight में heading, reason, हिंदी Shorts script, caption और 3-6 hashtags दें। उत्तर केवल वैध JSON हो: {"highlights":[{"startTime":"00:00","endTime":"00:45","heading":"","reason":"","script":"","caption":"","hashtags":["#Hindi"]}],"note":""}\n\nCAPTIONS (language: ' + captionData.language + '):\n' + captionData.transcript;

    let response;
    try {
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=' + encodeURIComponent(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.4 }
        }),
        signal: AbortSignal.timeout(45000)
      });
    } catch {
      return Response.json({ error: 'AI से जवाब आने में समय लग गया। कृपया दोबारा कोशिश करें।' }, { status: 504 });
    }
    const payload = await response.json();
    if (!response.ok) return Response.json({ error: payload.error?.message || 'Gemini से जवाब नहीं मिला। API key, model और quota जाँचें।' }, { status: 502 });
    const output = payload.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
    if (!output) return Response.json({ error: 'AI ने खाली जवाब दिया। दोबारा कोशिश करें।' }, { status: 502 });
    let parsed;
    try { parsed = JSON.parse(output); } catch {
      return Response.json({ error: 'AI का जवाब सही प्रारूप में नहीं आया। दोबारा कोशिश करें।' }, { status: 502 });
    }
    if (!Array.isArray(parsed.highlights)) return Response.json({ error: 'AI के जवाब में Shorts highlights नहीं मिले।' }, { status: 502 });
    return Response.json({
      status: 'analyzed',
      title: 'आपके AI Shorts Highlights',
      highlights: parsed.highlights.slice(0, 5),
      note: 'Captions की भाषा: ' + captionData.language + '। ये timestamps सुझाव हैं; clip काटने से पहले जाँचें। वीडियो rendering और YouTube upload अभी उपलब्ध नहीं हैं।'
    });
  } catch (error) {
    return Response.json({ error: error.message || 'अनुरोध पढ़ने या विश्लेषण में समस्या हुई।' }, { status: 500 });
  }
}
