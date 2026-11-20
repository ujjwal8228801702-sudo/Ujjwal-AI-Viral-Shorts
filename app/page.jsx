'use client';
import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function analyze(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!rights) {
      setError('पहले पुष्टि करें कि वीडियो आपका है या आपके पास उपयोग की अनुमति है।');
      return;
    }
    if (transcript.trim().length < 80) {
      setError('कृपया वीडियो का transcript कम से कम 80 अक्षरों में पेस्ट करें।');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, transcript })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'विश्लेषण नहीं हो पाया');
      setResult(d);
    } catch (err) {
      setError(err.message || 'कनेक्शन में समस्या हुई।');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <header><div className="logo">U</div><div><p className="eyebrow">AI CREATOR STUDIO</p><h1>Ujjwal AI <span>Viral Shorts</span></h1></div></header>
      <section className="hero">
        <div className="tag">✦ AI HIGHLIGHT PLANNER</div>
        <h2>Transcript से Shorts के आइडिया बनाइए</h2>
        <p>YouTube लिंक और वीडियो का transcript डालें। AI transcript में दिए गए समय के आधार पर highlights, Shorts scripts और captions सुझाएगा।</p>
        <form onSubmit={analyze}>
          <label htmlFor="url">YouTube वीडियो लिंक (वैकल्पिक)</label>
          <input id="url" type="url" placeholder="https://www.youtube.com/watch?v=..." value={url} onChange={e => setUrl(e.target.value)} />
          <label htmlFor="transcript">वीडियो का Transcript यहाँ पेस्ट करें</label>
          <textarea id="transcript" rows="9" placeholder={'उदाहरण:\n[00:00] नमस्कार दोस्तों...\n[00:35] आज हम एक खास बात जानेंगे...'} value={transcript} onChange={e => setTranscript(e.target.value)} required />
          <p className="hint">टाइमस्टैम्प जैसे [00:35] या 00:35 transcript में हों तो AI उन्हीं का उपयोग करेगा। बिना समय वाले transcript में सटीक clip timestamp नहीं बनाया जाएगा।</p>
          <label className="check"><input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} /><span>यह वीडियो मेरा है या मेरे पास इसे उपयोग, एडिट और प्रकाशित करने की स्पष्ट अनुमति है।</span></label>
          <button disabled={busy}>{busy ? 'AI विश्लेषण कर रहा है…' : 'AI Highlights बनाएँ →'}</button>
        </form>
        {error && <p className="error">{error}</p>}
        {result && <div className="result">
          <h3>{result.title || 'AI Highlights'}</h3>
          {result.highlights?.map((h, i) => <article className="highlight" key={i}>
            <div className="time">{h.startTime || 'समय उपलब्ध नहीं'}{h.endTime ? ' – ' + h.endTime : ''}</div>
            <h4>{h.heading}</h4><p>{h.reason}</p>
            <p><b>Shorts Script:</b> {h.script}</p>
            <p><b>Caption:</b> {h.caption}</p>
            <p><b>Hashtags:</b> {h.hashtags?.join(' ')}</p>
          </article>)}
          {result.note && <small>{result.note}</small>}
        </div>}
      </section>
      <section className="grid">
        <article><b>01</b><h3>Transcript analysis</h3><p>दिए गए transcript से AI महत्वपूर्ण हिस्से पहचानता है।</p></article>
        <article><b>02</b><h3>Shorts scripts</h3><p>Hook, छोटी script, caption और hashtags तैयार होते हैं।</p></article>
        <article><b>03</b><h3>Copyright guard</h3><p>सिर्फ original या licensed media इस्तेमाल करें। कोई जाँच 100% copyright-free होने की गारंटी नहीं देती।</p></article>
        <article><b>04</b><h3>Review before publish</h3><p>वीडियो render और YouTube upload अगला चरण है; पहले Private upload और YouTube Checks होंगे।</p></article>
      </section>
      <footer>Ujjwal AI · सुरक्षित और अनुमति-आधारित कंटेंट निर्माण</footer>
    </main>
  );
}
