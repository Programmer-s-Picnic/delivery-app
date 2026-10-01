'use strict';
const API='https://cserver.learnwithchampak.live/delivery/api/', $=id=>document.getElementById(id);
const adminSession=window.AdminSession;
let customerToken='',partnerToken='';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
function note(s,error=false){
  $('message').textContent=s;
  $('message').className=error?'error':'notice'
}
async function request(action,method='GET',data=null,auth=''){
  const headers={
    'Content-Type':'application/json'
  };
  if(auth==='admin')Object.assign(headers,adminSession.headers());
  if(auth==='customer')headers.Authorization='Bearer '+customerToken;
  if(auth==='partner')headers.Authorization='Bearer '+partnerToken;
  const response=await AppHttp.fetch(API+'?action='+encodeURIComponent(action),{
    method,headers,body:data?JSON.stringify(data):undefined,cache:'no-store'
  });
  let result;
  try{
    result=await response.json()
  }catch{
    throw Error('Server response was invalid')
  }if(!response.ok){
    if(auth==='admin'&&response.status===401)adminSession.clear();
    throw Error(result.error||'Request failed');
  }return result
}
function run(fn){
  return async(...args)=>{
    try{
      await fn(...args)
    }catch(e){
      note(e.message||'Request failed',true)
    }
  }
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{
  document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==button.dataset.view);
  document.querySelectorAll('[data-view]').forEach(el=>el.setAttribute('aria-selected',String(el===button)));
  note('')
});
$('file').onchange=run(async()=>{
  let f=$('file').files[0];
  if(!f)return;
  if(f.size>1024*1024)throw Error('JSON file must be under 1 MB');
  let raw=await f.text();
  JSON.parse(raw);
  $('cart').value=raw;
  note('Cart loaded for review. Import by Easy Mandi order ID.')
});
$('adminLogin').onclick=run(async()=>{
  await adminSession.login($('adminPassword').value);
  $('adminPassword').value='';
  await loadAdmin();
  $('adminArea').hidden=false;
  $('adminLogout').hidden=false;
  $('adminPassword').parentElement.hidden=true;
  $('adminLogin').hidden=true;
  $('adminPassword').value='';
  note('Admin access verified')
});
$('adminLogout').onclick=()=>{
  adminSession.clear();
  $('adminArea').hidden=true;
  $('adminLogout').hidden=true;
  $('adminPassword').parentElement.hidden=false;
  $('adminLogin').hidden=false;
  $('adminOrders').replaceChildren();
  note('Admin locked')
};
async function loadAdmin(focusId=null){
  const token=adminSession.token;
  const data=await request('admin','POST',{
    operation:'list'
  },'admin');
  if(!token||adminSession.token!==token)return;
  partnerRecords=data.partners;renderPartnerList();
  $('adminOrders').replaceChildren();
  for(const o of data.orders){
    const article=document.createElement('article');
    article.className='order';
    article.dataset.orderId=String(o.id);
    article.dataset.status=o.status;
    article.dataset.search=(o.external_order_id+' '+o.customer_name+' '+o.address_text).toLowerCase();
    const title=document.createElement('h4');
    title.textContent=o.external_order_id+' · '+o.status;
    const details=document.createElement('p');
    details.textContent=o.customer_name+' · '+o.address_text;
    const select=document.createElement('select');
    const blank=document.createElement('option');
    blank.value='';
    blank.textContent='Assign delivery person';
    select.append(blank);
    for(const p of data.partners.filter(p=>p.active)){
      const option=document.createElement('option');
      option.value=p.id;
      option.textContent=p.name+' · '+p.mobile;
      select.append(option)
    }select.value=String(o.partner_id??'');
    const assign=document.createElement('button');
    assign.textContent='Assign';
    assign.onclick=run(async()=>{
      if(!select.value)throw Error('Select a delivery person');
      await request('admin','POST',{
        operation:'assign',id:Number(o.id),partner_id:Number(select.value)
      },'admin');
      note('Partner assigned');
      await loadAdmin(Number(o.id))
    });
    article.append(title,details,select,assign);
    if(o.location_lat!=null&&o.location_lng!=null){
      const map=document.createElement('a');
      map.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(o.location_lat+','+o.location_lng);
      map.target='_blank';
      map.rel='noopener noreferrer';
      map.textContent='Customer map pin';
      article.append(map)
    }if(['assigned','picked_up','out_for_delivery'].includes(o.status)){
      const issue=document.createElement('button');
      issue.textContent='Issue customer code';
      issue.onclick=run(async()=>{
        const result=await request('admin','POST',{
          operation:'issue-code',id:Number(o.id)
        },'admin');
        const msg='Your delivery '+o.external_order_id+' handoff code is '+result.code+'. Give it to the delivery person only after receiving your order. This code expires in 24 hours.';
        const link=document.createElement('a');
        link.href='https://wa.me/91'+result.customer_mobile+'?text='+encodeURIComponent(msg);
        link.target='_blank';
        link.rel='noopener noreferrer';
        link.textContent='Send code to customer by WhatsApp';
        const p=document.createElement('p');
        p.textContent='Code: '+result.code+' · Send it now. It will not be shown again.';
        article.append(p,link);
        note('Code issued. Use the WhatsApp link to send it to the customer.')
      });
      article.append(issue)
    }const inspect=document.createElement('button');
    inspect.type='button';
    inspect.textContent='Show full order details';
    inspect.className='detail-button';
    inspect.setAttribute('aria-expanded','false');
    const panel=document.createElement('section');
    panel.className='order-detail';
    panel.hidden=true;
    inspect.onclick=run(async()=>{
      if(!panel.hidden){
        panel.hidden=true;
        inspect.textContent='Show full order details';
        inspect.setAttribute('aria-expanded','false');
        return
      }await showOrderDetail(article,Number(o.id))
    });
    article.append(inspect,panel);
    $('adminOrders').append(article)
  }if(!data.orders.length)$('adminOrders').textContent='No deliveries yet.';
  filterDeliveries();
  if(Number.isInteger(Number(focusId))&&focusId!==null){
    const selected=[...$('adminOrders').children].find(el=>el.dataset.orderId===String(focusId));
    if(selected){
      await showOrderDetail(selected,Number(focusId));
      selected.scrollIntoView({
        behavior:'smooth',block:'start'
      })
    }
  }
}
function detailText(root,label,value){
  const p=document.createElement('p');
  const strong=document.createElement('strong');
  strong.textContent=label+': ';
  p.append(strong,document.createTextNode(String(value??'Not available')));
  root.append(p)
}
async function showOrderDetail(article,id){
  const data=await request('admin','POST',{
    operation:'detail',id
  },'admin'),o=data.order,panel=article.querySelector('.order-detail'),button=article.querySelector('.detail-button');
  panel.replaceChildren();
  const heading=document.createElement('h5');
  heading.textContent='Full order details';
  panel.append(heading);
  const grid=document.createElement('div');
  grid.className='detail-grid';
  detailText(grid,'Delivery ID',o.id);
  detailText(grid,'Source',o.source_app);
  detailText(grid,'Source order ID',o.external_order_id);
  detailText(grid,'Delivery status',o.status);
  detailText(grid,'Customer',o.customer_name);
  detailText(grid,'Mobile',o.customer_mobile);
  detailText(grid,'Full address',o.address_text);
  if(o.location_lat!=null&&o.location_lng!=null){
    const map=document.createElement('a');
    map.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(o.location_lat+','+o.location_lng);
    map.target='_blank';
    map.rel='noopener noreferrer';
    map.textContent='Open customer location';
    grid.append(map)
  }
  detailText(grid,'Assigned partner',o.partner_name?o.partner_name+' · '+o.partner_mobile:'Not assigned');
  detailText(grid,'Imported',o.created_at);
  detailText(grid,'Updated',o.updated_at);
  if(o.source_app==='easymandi'){
    detailText(grid,'Easy Mandi order status',o.source_status);
    detailText(grid,'Easy Mandi order placed',o.source_created_at);
    for(const [label,value] of [['Subtotal',o.source_subtotal],['Delivery fee',o.source_delivery_fee],['Order total',o.source_total]])detailText(grid,label,value===null?'Not available':'₹'+Number(value).toFixed(2))
  }
  else detailText(grid,'Payment total','Not provided for manual cart');
  panel.append(grid);
  const itemsHeading=document.createElement('h5');
  itemsHeading.textContent='Cart items';
  panel.append(itemsHeading);
  const items=document.createElement('ol');
  for(const item of Array.isArray(o.items)?o.items:[]){
    const li=document.createElement('li');
    const name=item.name??item.product_name??'Item';
    const price=item.unit_price==null?'':' · ₹'+Number(item.unit_price).toFixed(2)+' each';
    const total=item.line_total==null?'':' · ₹'+Number(item.line_total).toFixed(2);
    li.textContent=String(name)+' × '+String(item.quantity??'')+' '+String(item.unit??'')+price+total;
    items.append(li)
  }if(!items.children.length){
    const li=document.createElement('li');
    li.textContent='No items stored';
    items.append(li)
  }panel.append(items);
  const eventsHeading=document.createElement('h5');
  eventsHeading.textContent='Delivery history';
  panel.append(eventsHeading);
  const history=document.createElement('ol');
  for(const event of data.events||[]){
    const li=document.createElement('li');
    li.textContent=String(event.event_type).replaceAll('_',' ')+' · '+event.created_at+' · '+event.actor;
    history.append(li)
  }panel.append(history);
  panel.hidden=false;
  button.textContent='Hide full order details';
  button.setAttribute('aria-expanded','true');
}
$('refreshAdmin').onclick=run(()=>loadAdmin());
$('import').onclick=run(async()=>{
  let id=$('externalId').value.trim();
  if(!id)throw Error('Enter an Easy Mandi order ID');
  const result=await request('admin','POST',{
    operation:'import',source_app:'easymandi',external_order_id:id
  },'admin');
  note('Delivery '+result.id+(result.existing?' already exists':' created'));
  await loadAdmin(Number(result.id))
});
$('manualImport').onclick=run(async()=>{
  let cart;
  try{
    cart=JSON.parse($('cart').value)
  }catch{
    throw Error('Paste or upload valid cart JSON')
  }const result=await request('admin','POST',{
    operation:'manual-import',external_order_id:$('manualId').value.trim(),customer_name:$('manualName').value.trim(),customer_mobile:$('manualMobile').value.trim(),address:$('manualAddress').value.trim(),cart
  },'admin');
  note('Delivery '+result.id+(result.existing?' already exists':' created'));
  await loadAdmin(Number(result.id))
});
let partnerRecords=[],editingPartner=null,partnerBusy=false;
function partnerFeedback(text,error=false){$('partnerFeedback').textContent=text;$('partnerFeedback').className=error?'error':'notice';}
function openPartner(record=null){
 editingPartner=record;$('partnerFormTitle').textContent=record?'Update delivery partner':'Add delivery partner';
 $('partnerName').value=record?.name||'';$('partnerMobile').value=record?.mobile||'';$('partnerPassword').value='';$('partnerActive').value=record&& !Number(record.active)?'no':'yes';
 $('partnerActiveLabel').hidden=!record;$('partnerPasswordHelp').textContent=record?'Leave password blank to keep the existing password. Changing it signs the partner out.':'Use 12–256 characters.';
 $('createPartner').textContent=record?'Save changes':'Create partner';$('partnerFormError').textContent='';
 for(const key of ['Name','Mobile','Password']){$('partner'+key+'Error').textContent='';$('partner'+key).setAttribute('aria-invalid','false');}
 $('partnerDialog').showModal();$('partnerName').focus();
}
function renderPartnerList(){
 const root=$('partnerList');root.replaceChildren();const query=$('partnerSearch').value.trim().toLowerCase(),filter=$('partnerFilter').value||'all';
 const rows=partnerRecords.filter(p=>(p.name+' '+p.mobile+' '+p.id).toLowerCase().includes(query)&&(filter==='all'||Boolean(Number(p.active))===(filter==='active')));
 $('partnerCount').textContent=rows.length+' of '+partnerRecords.length+' partners · '+partnerRecords.filter(p=>Number(p.active)).length+' active';
 if(!rows.length){root.textContent='No matching partners. Add a partner or change the filters.';return;}
 const table=document.createElement('table');table.className='partner-grid';const head=document.createElement('thead'),row=document.createElement('tr');
 for(const label of ['ID','Name','Mobile','Status','Actions']){const th=document.createElement('th');th.textContent=label;th.setAttribute('scope','col');row.append(th);}head.append(row);table.append(head);const body=document.createElement('tbody');
 for(const p of rows){const tr=document.createElement('tr');for(const text of [p.id,p.name,p.mobile,Number(p.active)?'Active':'Inactive']){const td=document.createElement('td');td.textContent=text;tr.append(td);}
 const td=document.createElement('td');const controls=document.createElement('div');controls.className='partner-actions';
 const update=document.createElement('button');update.type='button';update.className='secondary';update.textContent='Update';update.onclick=()=>openPartner(p);
 const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Delete';remove.disabled=partnerBusy;
 remove.onclick=async()=>{
  if(partnerBusy||!confirm('Delete '+p.name+' ('+p.mobile+')? Accounts with delivery history must be deactivated instead.'))return;
  partnerBusy=true;renderPartnerList();
  try{await request('admin','POST',{operation:'partner-delete',id:Number(p.id)},'admin');partnerRecords=partnerRecords.filter(x=>x!==p);renderPartnerList();partnerFeedback('Partner '+p.name+' deleted successfully.');try{await loadAdmin();}catch{partnerFeedback('Partner deleted. Could not refresh deliveries; choose Refresh.');}}
  catch(e){partnerFeedback(e.message,true);}finally{partnerBusy=false;renderPartnerList();}
 };
 controls.append(update,remove);td.append(controls);tr.append(td);body.append(tr);}
 table.append(body);root.append(table);
}
$('newPartner').onclick=()=>openPartner();$('partnerSearch').oninput=renderPartnerList;$('partnerFilter').onchange=renderPartnerList;
$('partnerCancel').onclick=()=>{if(!partnerBusy)$('partnerDialog').close();};
$('partnerDialog').addEventListener('cancel',e=>{if(partnerBusy)e.preventDefault();});
$('partnerDialog').addEventListener('close',()=>{$('partnerPassword').value='';});
$('partnerForm').onsubmit=async event=>{
 event.preventDefault();if(partnerBusy)return;
 const name=$('partnerName').value.trim(),mobile=$('partnerMobile').value.trim(),password=$('partnerPassword').value;
 const errors={};if(new TextEncoder().encode(name).length<2||new TextEncoder().encode(name).length>120)errors.Name='Enter a name between 2 and 120 bytes.';
 if(!/^[6-9][0-9]{9}$/.test(mobile))errors.Mobile='Enter a 10-digit Indian mobile number starting with 6–9.';
 const bytes=new TextEncoder().encode(password).length;if((!editingPartner||password!=='')&&(bytes<12||bytes>256))errors.Password='Password must contain 12–256 bytes.';
 for(const key of ['Name','Mobile','Password']){$('partner'+key+'Error').textContent=errors[key]||'';$('partner'+key).setAttribute('aria-invalid',errors[key]?'true':'false');}
 if(Object.keys(errors).length){$('partnerFormError').textContent='Please correct the highlighted fields.';$('partner'+Object.keys(errors)[0]).focus();return;}
 partnerBusy=true;$('createPartner').disabled=true;$('partnerFormError').textContent='Saving…';
 try{
  const editing=!!editingPartner;const result=await request('admin','POST',{operation:editing?'partner-update':'partner-create',...(editing?{id:Number(editingPartner.id),active:$('partnerActive').value==='yes'}:{}),name,mobile,password},'admin');
  if(editing)Object.assign(editingPartner,{name,mobile,active:$('partnerActive').value==='yes'?1:0});else partnerRecords.push({id:result.id,name,mobile,active:1});
  $('partnerPassword').value='';$('partnerDialog').close();renderPartnerList();partnerFeedback('Partner '+name+(editing?' updated':' created')+' successfully.');
  try{await loadAdmin();}catch{partnerFeedback('Partner saved successfully. Could not refresh deliveries; choose Refresh.');}
 }catch(e){$('partnerFormError').textContent=e.message||'Could not save partner.';}finally{partnerBusy=false;$('createPartner').disabled=false;}
};
window.addEventListener('admin-session-ended',()=>{partnerRecords=[];$('partnerList').replaceChildren();$('partnerCount').textContent='';$('partnerFeedback').textContent='';$('partnerDialog').close();});
$('customerLogin').onclick=run(async()=>{
  customerToken=$('customerToken').value.trim();
  await loadCustomer();
  $('customerToken').value='';
  note('Customer deliveries loaded')
});
$('customerLogout').onclick=()=>{
  customerToken='';
  $('customerOrders').replaceChildren();
  $('customerNotifications').replaceChildren();
  note('Customer token cleared')
};
async function loadCustomer(){
  const data=await request('customer','GET',null,'customer');
  $('customerOrders').replaceChildren();
  for(const o of data.orders){
    let article=document.createElement('article');
    article.className='order';
    article.dataset.orderId=String(o.id);
    let title=document.createElement('h4');
    title.textContent=o.external_order_id+' · '+o.status;
    let p=document.createElement('p');
    p.textContent='Track this order here. The admin sends the handoff code separately.';
    article.append(title,p);
    if(['assigned','picked_up','out_for_delivery'].includes(o.status)){
      let hint=document.createElement('p');
      hint.textContent='The admin will send your handoff code. Give it to the delivery person only after receiving your order.';
      article.append(hint)
    }$('customerOrders').append(article)
  }if(!data.orders.length)$('customerOrders').textContent='No delivery orders linked to this account.';
}
$('loginPartner').onclick=run(async()=>{
  const data=await request('partner-login','POST',{
    mobile:$('loginMobile').value.trim(),password:$('loginPassword').value
  });
  partnerToken=data.token;
  $('loginPassword').value='';
  $('partnerLogin').hidden=true;
  $('partnerArea').hidden=false;
  await loadPartner();
  note('Signed in')
});
$('logoutPartner').onclick=()=>{
  partnerToken='';
  $('partnerArea').hidden=true;
  $('partnerLogin').hidden=false;
  $('partnerOrders').replaceChildren();
  note('Signed out')
};
$('refreshPartner').onclick=run(loadPartner);
async function loadPartner(){
  const data=await request('partner','GET',null,'partner');
  $('partnerOrders').replaceChildren();
  for(const o of data.orders){
    let article=document.createElement('article');
    article.className='order';
    article.dataset.orderId=String(o.id);
    let h=document.createElement('h4');
    h.textContent=o.external_order_id+' · '+o.status;
    let p=document.createElement('p');
    p.textContent=o.customer_name+' · '+o.address_text;
    article.append(h,p);
    if(o.location_lat!=null&&o.location_lng!=null){
      const map=document.createElement('a');
      map.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(o.location_lat+','+o.location_lng);
      map.target='_blank';
      map.rel='noopener noreferrer';
      map.textContent='Navigate to customer';
      article.append(map)
    }const next={
      assigned:'picked_up',picked_up:'out_for_delivery'
    }[o.status];
    if(next){
      let button=document.createElement('button');
      button.textContent='Mark '+next.replaceAll('_',' ');
      button.onclick=run(async()=>{
        await request('partner','POST',{
          operation:'status',id:Number(o.id),status:next
        },'partner');
        await loadPartner();
        note('Status updated')
      });
      article.append(button)
    }if(o.status==='out_for_delivery'){
      let input=document.createElement('input');
      input.placeholder='Six-digit code from customer';
      input.inputMode='numeric';
      input.maxLength=6;
      let button=document.createElement('button');
      button.textContent='Confirm handoff';
      button.onclick=run(async()=>{
        await request('partner','POST',{
          operation:'confirm',id:Number(o.id),code:input.value.trim()
        },'partner');
        input.value='';
        await loadPartner();
        note('Delivery confirmed; notifications recorded')
      });
      article.append(input,button)
    }$('partnerOrders').append(article)
  }if(!data.orders.length)$('partnerOrders').textContent='No assigned jobs.';
}
function filterDeliveries(){
  const query=$('deliverySearch').value.trim().toLowerCase(),status=$('deliveryFilter').value;
  const cards=[...$('adminOrders').querySelectorAll('.order')];
  let shown=0;
  for(const card of cards){
    card.hidden=!(card.dataset.search.includes(query)&&(!status||String(card.dataset.status).trim().toLowerCase()===status));
    if(!card.hidden)shown++
  }
  $('deliveryCount').textContent=shown+' of '+cards.length+' deliveries';
}
$('deliverySearch').oninput=filterDeliveries;
$('deliveryFilter').onchange=filterDeliveries;
const incomingOrder=new URLSearchParams(location.search).get('order');
if(incomingOrder){
  $('externalId').value=incomingOrder;
  note('Order ID received from Easy Mandi. Sign in, review it and choose Import order.')
}
const inboxes={
};
for(const role of ['admin','customer','partner']){
  const fetchInbox=async(body=null)=>{
    const headers={
      'Content-Type':'application/json'
    };
    if(role==='admin')Object.assign(headers,adminSession.headers());
    else headers.Authorization='Bearer '+(role==='customer'?customerToken:partnerToken);
    const r=await AppHttp.fetch(API+'?action=notifications&audience='+role,{
      method:body?'POST':'GET',headers,cache:'no-store',...(body?{
        body:JSON.stringify(body)
      }:{
      })
    });
    const data=await r.json();
    if(!r.ok)throw Error(data.error||'Could not load notifications');
    return data;
  };
  inboxes[role]=new NotificationInbox($(role+'Notifications'),()=>fetchInbox(),id=>fetchInbox({
    id
  }),n=>{
    const root=$(role==='admin'?'adminOrders':role==='partner'?'partnerOrders':'customerOrders');
    const card=[...root.children].find(c=>c.dataset.orderId===String(n.order_id));
    card?.scrollIntoView({
      behavior:'smooth'
    });
  });
}
setInterval(()=>{
  for(const role of ['admin','customer','partner']){
    const active=!!(role==='admin'?adminSession.token:role==='customer'?customerToken:partnerToken);
    if(active!==inboxes[role].active){
      inboxes[role].active=active;
      if(active)inboxes[role].refresh().catch(()=>{
      });
      else inboxes[role].stop();
    }
  }
},3000);
setInterval(()=>{
  if(adminSession.token&&!document.hidden)loadAdmin().catch(e=>note(e.message,true));
},300000);
window.addEventListener('admin-session-ended',()=>{
  $('adminArea').hidden=true;
  $('adminLogout').hidden=true;
  $('adminPassword').parentElement.hidden=false;
  $('adminLogin').hidden=false;
  $('adminOrders').replaceChildren();
  inboxes.admin.stop();
  note('Admin session ended after 30 minutes. Enter the password again.');
});
async function resumeAdmin(){
  if(!adminSession.token)return;
  try{
    await loadAdmin();
    $('adminArea').hidden=false;
    $('adminLogout').hidden=false;
    $('adminPassword').parentElement.hidden=true;
    $('adminLogin').hidden=true;
    inboxes.admin.active=true;
    await inboxes.admin.refresh();
    note('Admin access active for 30 minutes from password entry.');
  }catch(e){
    note(e.message,true);
  }
}
if(adminSession.token)resumeAdmin();
