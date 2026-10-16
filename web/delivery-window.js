/* Four-hour delivery window, rendered with India Standard Time. */
(()=>{
 'use strict';
 const zone='Asia/Kolkata';
 function parse(raw){
  if(raw instanceof Date)return Number.isFinite(raw.getTime())?raw:null;
  if(raw==null||String(raw).trim()==='')return null;
  let text=String(raw).trim();
  if(/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.test(text)&&!/(Z|[+-]\d{2}:?\d{2})$/i.test(text))text=text.replace(' ','T')+'+05:30';
  const d=new Date(text);return Number.isFinite(d.getTime())?d:null;
 }
 function time(value){return new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:false}).format(value);}
 function message(raw,lang){
  const start=parse(raw);if(!start)return '';
  const deadline=new Date(start.getTime()+4*60*60*1000);
  return (lang==='hi'?'ऑर्डर समय: ':'Order Time: ')+time(start)+(lang==='hi'?' · अधिकतम डिलीवरी समय: ':' · Max Order Delivery Time: ')+time(deadline)+
   (lang==='hi'?' IST। आपका ऑर्डर 4 कार्य घंटों के भीतर डिलीवर किया जाएगा। Easy Mandi से ऑर्डर करते रहें और MANDI रेट पर बचत करें।':
    ' IST. Your order will be delivered within 4 working hours. Keep ordering with Easy Mandi and save on MANDI rate.');
 }
 function notice(raw,className='delivery-time-notice'){
  const el=document.createElement('p');el.className=className;
  const update=()=>{el.textContent=message(raw,window.EMI18n?.lang)};
  update();window.addEventListener('languagechange',update,{once:false});
  return el;
 }
 window.EasyMandiDeliveryWindow={parse,time,message,notice};
})();