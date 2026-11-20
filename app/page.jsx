'use client';
import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function analyze(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!url.trim()) {
      setError('पहले YouTube वीडियो का लिंक डालें।');
      return;
    }
    if (!rights) {
      setError('पहले पुष्टि करें कि वीडियो आपका है या आपके पास उपयोग की अनुमति है।');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
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
        <div className="tag">✦ AUTOMATIC SHORTS FINDER</div>
        <h2>सिर्फ YouTube लिंक डालें</h2>
        <p>AI वीडियो के उपलब्ध captions अपने-आप पढ़कर अच्छे Shorts moments, timestamps, Hindi scripts, captions और hashtags सुझाने की कोशिश करेगा। Transcript आपको पेस्ट नहीं करना है।</p>
        <form onSubmit={analyze}>
          <label htmlFor="url">YouTube वीडियो लिंक</label>
          <input id="url" type="url" placeholder="https://www.youtube.com/watch?v=..." value={url} onChange={e => setUrl(e.target.value)} required />
          <label className="check"><input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} /><span>यह वीडियो मेरा है या मेरे पास इसे उपयोग, एडिट और प्रकाशित करने की स्पष्ट अनुमति है।</span></label>
          <button disabled={busy}>{busy ? 'वीडियो के captions खोजे जा रहे हैं…' : 'Viral Shorts खोजें →'}</button>
        </form>
        <p className="hint">ध्यान दें: यह तभी काम करेगा जब YouTube उस वीडियो के captions उपलब्ध कराए और उन्हें पढ़ने की अनुमति हो। हर वीडियो के captions नहीं मिलते। अभी यह highlights और clip timestamps सुझाता है; असली वीडियो काटना और YouTube पर upload करना अगला चरण है।</p>
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
        <article><b>01</b><h3>Automatic captions</h3><p>उपलब्ध YouTube captions अपने-आप प्राप्त करने की कोशिश।</p></article>
        <article><b>02</b><h3>AI highlight finder</h3><p>महत्वपूर्ण moments, timestamps, Hindi scripts और hashtags।</p></article>
        <article><b>03</b><h3>Copyright guard</h3><p>सिर्फ original या licensed media इस्तेमाल करें।</p></article>
        <article><b>04</b><h3>Next: clip & upload</h3><p>वीडियो rendering और YouTube upload अभी इस संस्करण में उपलब्ध नहीं हैं।</p></article>
      </section>
      <footer>Ujjwal AI · सुरक्षित और अनुमति-आधारित कंटेंट निर्माण</footer>
    </main>
  );
}
