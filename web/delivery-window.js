/* Easy Mandi Delivery Policy V2 — 07:00-23:00 IST, after confirmation. */
(()=>{
 'use strict';
 const M=60000,H=60*M,D=24*H,OFFSET=330*M;
 const zone='Asia/Kolkata';
 function parse(raw){
  if(raw instanceof Date)return Number.isFinite(raw.getTime())?raw:null;
  if(raw==null||String(raw).trim()==='')return null;
  let v=String(raw).trim();
  if(/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.test(v)&&!/(?:Z|[+-]\d\d:?\d\d)$/i.test(v))v=v.replace(' ','T')+'+05:30';
  const d=new Date(v);return Number.isFinite(d.getTime())?d:null;
 }
 function isOpen(at=new Date()){const v=parse(at);if(!v)return false;const n=new Date(v.getTime()+OFFSET);const min=n.getUTCHours()*60+n.getUTCMinutes();return min>=420&&min<1380;}
 function targetAt(raw){
  const dt=parse(raw);if(!dt)return null;
  let ist=dt.getTime()+OFFSET,day=Math.floor(ist/D),start=day*D+420*M,end=day*D+1380*M;
  if(ist<start)ist=start;
  if(ist>=end){day++;ist=day*D+420*M;end=day*D+1380*M;}
  const available=end-ist,remaining=60*M;
  return new Date((available>=remaining?ist+remaining:(day+1)*D+420*M+(remaining-available))-OFFSET);
 }
 function time(raw){const d=parse(raw);return d?new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d):'';}
 function message(order,lang){
  const hi=lang==='hi',o=(order && typeof order==='object' && !(order instanceof Date))?order:{created_at:order};
  const placed=parse(o.created_at||o.placed_at),confirmed=parse(o.confirmed_at);
  if(!confirmed){
    return (placed?(hi?'ऑर्डर समय: ':'Order Time: ')+time(placed)+' IST · ':'')+
      (hi?'पुष्टि की प्रतीक्षा है। पुष्टि के बाद 60 कार्य मिनट में डिलीवरी का प्रयास होगा। सुबह 7 से रात 11 बजे तक।':
          'Awaiting order confirmation. Delivery is attempted within 60 service minutes after confirmation (7 AM–11 PM IST).');
  }
  const goal=parse(o.delivery_target_at)||targetAt(confirmed);
  return (hi?'पुष्टि समय: ':'Confirmed: ')+time(confirmed)+' IST · '+
    (hi?'डिलीवरी प्रयास का लक्ष्य: ':'Delivery attempt target: ')+time(goal)+' IST. '+
    (hi?'ट्रैफिक, अधिक ऑर्डर या पीक आवर्स में देरी संभव है।':'Rush hours, traffic or high demand may delay delivery.');
 }
 function notice(order,className='delivery-time-notice'){
  const el=document.createElement('p');el.className=className;
  el.textContent=message(order,window.EMI18n?.lang);
  return el;
 }
 const closedText=()=>window.EMI18n?.lang==='hi'
   ?'ऑर्डर लेना बंद है। चेकआउट सुबह 7:00 बजे से रात 11:00 बजे तक (IST) खुला रहता है।'
   :'Checkout is closed. Order placement is available 7:00 AM–11:00 PM IST.';
 window.EasyMandiDeliveryWindow={parse,isOpen,targetAt,time,message,notice,closedText};
})();
