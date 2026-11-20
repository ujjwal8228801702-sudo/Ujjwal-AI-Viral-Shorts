export async function POST(req){
 try{
  const {url}=await req.json();
  let parsed;try{parsed=new URL(url)}catch{return Response.json({error:'सही YouTube URL डालें।'},{status:400})}
  const host=parsed.hostname.replace(/^www\./,'');
  if(!['youtube.com','m.youtube.com','youtu.be'].includes(host))return Response.json({error:'कृपया YouTube का लिंक डालें।'},{status:400});
  const videoId=host==='youtu.be'?parsed.pathname.slice(1):parsed.searchParams.get('v');
  if(!videoId)return Response.json({error:'इस लिंक से Video ID नहीं मिली।'},{status:400});
  return Response.json({status:'needs_setup',videoId,title:'YouTube वीडियो लिंक स्वीकार हुआ',message:'लिंक का प्रारूप सही है। अभी वास्तविक वीडियो transcript, timestamp detection और clip rendering सक्रिय नहीं हैं—इनके लिए अधिकृत source access और backend services जोड़नी होंगी।',nextSteps:['वीडियो का transcript या आपकी अपनी वीडियो फ़ाइल जोड़ना','AI से वास्तविक timestamps और Shorts script निकालना','केवल licensed/original media से clip render करना','YouTube OAuth से Private upload और Checks करना']});
 }catch{return Response.json({error:'अनुरोध पढ़ने में समस्या हुई।'},{status:400})}
}
