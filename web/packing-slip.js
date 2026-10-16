/* Per-order packing sheet and private admin notes (no QR/OTP is printed). */
(() => {
  'use strict';
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const knownHindi={"onion":"प्याज","potato":"आलू","tomato":"टमाटर","carrot":"गाजर","cauliflower":"फूलगोभी","cabbage":"पत्तागोभी","spinach":"पालक","coriander":"धनिया","green_chilli":"हरी मिर्च","green chilli":"हरी मिर्च","ginger":"अदरक","garlic":"लहसुन"};
  const format=n=>Number(n).toLocaleString('en-IN',{maximumFractionDigits:3});
  function printSheet(order,popup){
    const pop=popup||window.open('','_blank');
    if(!pop){alert('Allow pop-ups to print this slip.');return false;}
    const raw=order.source_created_at||order.created_at||'';
    let when=String(raw);
    if(/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.test(when)&&!/(?:Z|[+-]\d\d:?\d\d)$/i.test(when))when=when.replace(' ','T')+'+05:30';
    const date=new Date(when),dateText=raw&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',hour12:true}).format(date):String(raw||'—');
    const address=String(order.address_text||[order.house,order.locality,order.landmark,order.city,order.state,order.pin].filter(Boolean).join(', ')||'Not provided');
    const id=String(order.daily_index||order.public_id||order.external_order_id||order.id||'—').replace(/^#+/,'');
    const items=Array.isArray(order.items)?order.items:[];
    let packs=0,weight=0,unknown=false;
    const rows=items.map((item,index)=>{
      const qty=Number(item.quantity)||0,unit=String(item.unit||'pack'),name=String(item.product_name||item.name||'Product');
      packs+=qty;
      const match=unit.trim().match(/^(\d+(?:\.\d+)?)\s*(kilograms?|kgs?|kg|grams?|gms?|gm|g)(?=\s|$|\/)/i);
      let mass='';
      if(match){const kilos=qty*Number(match[1])*(match[2].toLowerCase().startsWith('k')?1:.001);weight+=kilos;mass='<small>('+format(kilos)+' kg)</small>';}
      else unknown=true;
      const hindi=String(item.hindi||item.hindi_name||knownHindi[String(item.product_id||'')]||knownHindi[name.toLowerCase()]||'');
      const title=name+(hindi&&!/[\u0900-\u097f]/.test(name)?' ('+hindi+')':'');
      return '<tr><td class="number">'+(index+1)+'</td><td class="product">'+h(title)+'</td><td class="quantity">'+h(unit+' × '+format(qty))+mass+'</td><td class="check"><i></i></td></tr>';
    }).join('');
    const notes=[order.customer_note,order.packer_note,order.partner_note].map(x=>String(x||'').trim()).filter(Boolean).map(h).join(' / ')||'None';
    const totalWeight=weight?format(weight)+' kg'+(unknown?'*':''):'—';
    const style=[
      '@page{size:3in 4in;margin:0}',
      '*{box-sizing:border-box}html,body{margin:0;padding:0}',
      'body{background:#eef2f5;color:#000;font-family:Arial,"Noto Sans Devanagari",Mangal,sans-serif}',
      '.controls{text-align:center;margin:12px auto}.controls button{background:#146bbb;color:#fff;border:0;border-radius:7px;padding:9px;font-weight:bold;cursor:pointer}',
      '.slip{width:3in;min-height:4in;margin:auto;padding:9px;background:#fff}',
      '.brand{text-align:center;font-size:18px;font-weight:900;line-height:1.1}',
      '.strap{display:table;margin:4px auto 9px;padding:2px 8px;border-radius:2px;background:#000;color:#fff;font-size:10px;font-weight:900}',
      '.reference{display:flex;justify-content:space-between;gap:3px;font-size:10px;font-weight:800;white-space:nowrap}',
      '.dash{border-top:2px dashed #000;margin:8px 0}',
      '.customer{display:flex;justify-content:space-between;gap:6px;font-size:12px;font-weight:800}',
      '.phone{font-size:9px;white-space:nowrap}',
      '.address{font-size:10px;line-height:1.3;margin:4px 0 7px;overflow-wrap:anywhere}',
      'table{border-collapse:collapse;table-layout:fixed;width:100%;font-size:10px}',
      'thead{display:table-header-group}th{text-align:left;padding:5px 2px;border-block:1px solid #000}',
      'td{border-bottom:1px dashed #c8c8c8;padding:8px 2px;vertical-align:top}tr{break-inside:avoid}',
      '.number{width:18px;text-align:center}.product{font-weight:800;overflow-wrap:anywhere}',
      '.quantity{width:72px;text-align:right;font-weight:800}.quantity small{display:block;font-size:9px}',
      '.check{width:18px;text-align:right}.check i{display:inline-block;width:12px;height:12px;border:1px solid #000}',
      '.totals{display:flex;justify-content:space-between;gap:4px;border-top:2px solid #000;border-bottom:1px solid #000;margin-top:9px;padding:5px 0;font-size:11px;font-weight:900}',
      '.sign{display:flex;justify-content:space-between;gap:7px;border-bottom:1px dashed #000;padding:11px 0 8px;font-size:9px;font-weight:700}',
      '.notes,.hindi{text-align:center;font-size:9px;line-height:1.45;font-weight:bold;margin-top:5px;overflow-wrap:anywhere}',
      '.hindi{font-size:8px}.foot{font-size:8px;text-align:center}',
      '@media print{body{background:#fff}.controls{display:none!important}.slip{margin:0;padding:9px;width:3in;min-height:0}.strap{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
    ].join('');
    const markup='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>EasyMandi Packing Slip - '+h(id)+'</title><style>'+style+'</style></head><body>'+
      '<div class="controls"><button onclick="window.print()">Print / Save as PDF</button></div>'+
      '<main class="slip"><div class="brand">EASYMANDI</div><div class="strap">PACKING &amp; DELIVERY SLIP</div>'+
      '<div class="reference"><span>Order ID: #'+h(id)+'</span><span>Date: '+h(dateText)+'</span></div><div class="dash"></div>'+
      '<div class="customer"><span>'+h(order.customer_name||'Customer')+'</span><span class="phone">'+(order.mobile||order.customer_mobile?'☎ '+h(order.mobile||order.customer_mobile):'')+'</span></div>'+
      '<p class="address"><strong>Address:</strong> '+h(address)+'</p>'+
      '<table><thead><tr><th class="number">#</th><th>Product</th><th class="quantity">Ord. Qty</th><th class="check">✓</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      '<div class="totals"><span>Total Items: '+h(format(packs))+' packs</span><span>Weight: '+h(totalWeight)+'</span></div>'+
      '<div class="sign"><span>Packer: ................</span><span>Checked By: ............</span></div>'+
      '<div class="notes">Special Instructions: '+notes+'</div>'+
      '<div class="hindi">Note: सभी उत्पादों की मात्रा और गुणवत्ता जाँचने के बाद ही ऑर्डर डिलीवरी के लिए दें।</div>'+
      (unknown&&weight?'<p class="foot">* Weight excludes non-weight items.</p>':'')+'</main></body></html>';
    pop.document.open();pop.document.write(markup);pop.document.close();
    pop.addEventListener('load',()=>{pop.focus();pop.print();},{once:true});
    return true;
  }
  function append(order,root,saveNotes){
    const section=document.createElement('section');section.className='order-note-editor';
    const title=document.createElement('h4');title.textContent='Packing and delivery notes';section.append(title);
    const customer=document.createElement('p');customer.textContent='Customer: '+(order.customer_note||'No instructions supplied');section.append(customer);
    const fields=[['packer_note','Packer instructions'],['partner_note','Delivery partner instructions']];
    const controls={};
    for(const [name,label] of fields){
      const wrap=document.createElement('label');wrap.textContent=label;
      const input=document.createElement('textarea');input.rows=2;input.maxLength=500;input.value=order[name]||'';
      wrap.append(input);section.append(wrap);controls[name]=input;
    }
    const feedback=document.createElement('p');feedback.setAttribute('role','status');
    const actions=document.createElement('div');actions.className='row';
    const save=document.createElement('button');save.type='button';save.className='btn secondary';save.textContent='Save instructions';
    save.onclick=async()=>{
      save.disabled=true;feedback.textContent='';
      try{
        await saveNotes({orderId:order.public_id,packerNote:controls.packer_note.value.trim(),partnerNote:controls.partner_note.value.trim()});
        order.packer_note=controls.packer_note.value.trim();order.partner_note=controls.partner_note.value.trim();
        feedback.textContent='Instructions saved to server.';
      }catch(e){feedback.textContent=e.message||'Could not save instructions.';}
      finally{save.disabled=false;}
    };
    const print=document.createElement('button');print.type='button';print.className='btn secondary';print.textContent='Print Slip';print.onclick=()=>printSheet(order);
    actions.append(save,print);section.append(actions,feedback);root.append(section);
  }
  window.EasyMandiPacking={append,printSheet};
})();
