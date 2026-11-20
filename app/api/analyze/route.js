export async function POST(req) {
  try {
    const { url = '', transcript = '' } = await req.json();
    if (typeof transcript !== 'string' || transcript.trim().length < 80) {
      return Response.json({ error: 'कृपया कम से कम 80 अक्षरों का transcript पेस्ट करें।' }, { status: 400 });
    }
    if (transcript.length > 60000) {
      return Response.json({ error: 'Transcript बहुत लंबा है। कृपया 60,000 अक्षरों से छोटा transcript दें।' }, { status: 413 });
    }
    if (url) {
      let parsed;
      try { parsed = new URL(url); } catch {
        return Response.json({ error: 'YouTube लिंक का प्रारूप सही नहीं है।' }, { status: 400 });
      }
      const host = parsed.hostname.replace(/^www\./, '');
      if (!['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
        return Response.json({ error: 'कृपया YouTube का लिंक डालें।' }, { status: 400 });
      }
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({
        error: 'Gemini API key अभी Vercel में सेट नहीं है। Vercel → Settings → Environment Variables में GEMINI_API_KEY जोड़ें।'
      }, { status: 503 });
    }

    const prompt = `आप हिंदी Shorts content planner हैं। नीचे दिए transcript का विश्लेषण करें। केवल transcript में मौजूद तथ्यों का उपयोग करें; कुछ गढ़ें नहीं। 3 से 5 अच्छे Shorts highlights दें। startTime और endTime केवल तभी दें जब transcript में स्पष्ट timestamp मौजूद हो; timestamp न हो तो दोनों खाली string रखें और कोई समय अनुमान से न बनाएं। हर highlight में heading, reason, 30-60 सेकंड की हिंदी बोलने योग्य script, caption और 3-6 hashtags दें। उत्तर केवल वैध JSON हो, इस schema में: {"highlights":[{"startTime":"","endTime":"","heading":"","reason":"","script":"","caption":"","hashtags":["#Hindi"]}],"note":"..."}\n\nTRANSCRIPT:\n${transcript}`;
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 }
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      return Response.json({ error: payload.error?.message || 'Gemini से जवाब नहीं मिला। API key और quota जाँचें।' }, { status: 502 });
    }
    const text = payload.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
    if (!text) return Response.json({ error: 'AI ने खाली जवाब दिया। दोबारा कोशिश करें।' }, { status: 502 });
    let parsed;
    try { parsed = JSON.parse(text); } catch {
      return Response.json({ error: 'AI का जवाब सही JSON में नहीं आया। दोबारा कोशिश करें।' }, { status: 502 });
    }
    if (!Array.isArray(parsed.highlights)) {
      return Response.json({ error: 'AI के जवाब में highlights नहीं मिले।' }, { status: 502 });
    }
    return Response.json({
      status: 'analyzed',
      title: 'आपके AI Shorts Highlights',
      highlights: parsed.highlights.slice(0, 5),
      note: parsed.note || 'ये transcript पर आधारित सुझाव हैं। वीडियो में सही clip cut करने से पहले timestamps स्वयं जाँचें।'
    });
  } catch (error) {
    return Response.json({ error: 'अनुरोध पढ़ने या विश्लेषण में समस्या हुई।' }, { status: 500 });
  }
}
