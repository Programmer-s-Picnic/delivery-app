const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..');
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.dataset={};this.value='';this.hidden=false;this.textContent='';this.style={};this.parentElement={hidden:false};this.open=false;this.attributes={};this.previousElementSibling={textContent:''};}
 append(...nodes){if(this.tagName==='select'&&!this.children.length&&nodes[0])this.value=nodes[0].value;this.children.push(...nodes);nodes.forEach(n=>{if(n&&typeof n==='object')n.parentElement=this;});}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 after(){} insertBefore(n){this.append(n)} closest(){return null} remove(){} focus(){} scrollIntoView(){}
 setAttribute(k,v){this.attributes[k]=v} getAttribute(k){return this.attributes[k]}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn)}
 async fire(name){for(const f of this.listeners[name]||[])await f({target:this,currentTarget:this,preventDefault(){}});if(this['on'+name])await this['on'+name]({target:this,currentTarget:this,preventDefault(){}})}
 querySelectorAll(sel){const all=this.children.filter(n=>n&&typeof n==='object').flatMap(n=>[n,...n.querySelectorAll(sel)]);return all.filter(n=>sel==='[data-order-status]'?'orderStatus' in n.dataset:sel==='.order'?n.className==='order':true)}
 showModal(){this.open=true} close(){this.open=false} setCustomValidity(){} reportValidity(){return true}
 set innerHTML(v){this.children=[];this._html=v} get innerHTML(){return this._html||''}
}
function harness(html){
 const nodes={};for(const [,id]of html.matchAll(/\bid="([^"]+)"/g))nodes[id]=new Element();
 const all=[];const document={hidden:false,head:new Element(),body:new Element(),getElementById:id=>nodes[id]||all.find(n=>n.id===id),createElement:tag=>{const n=new Element(tag);all.push(n);return n},createTextNode:text=>text,querySelectorAll:()=>[],addEventListener(){}};
 const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
 const events={},timers=[];const window={addEventListener:(n,f)=>(events[n]??=[]).push(f),dispatchEvent:e=>(events[e.type]||[]).forEach(f=>f())};
 const ctx={window,document,sessionStorage:storage,localStorage:storage,AbortController,URL,URLSearchParams,TextEncoder,crypto:require('node:crypto').webcrypto,Date,Event,console,confirm:()=>true,alert(){},navigator:{},location:{search:''},setInterval:f=>{timers.push(f);return timers.length},clearInterval(){},setTimeout:f=>{timers.push(f);return timers.length},clearTimeout(){},MutationObserver:class{observe(){}disconnect(){}},FormData:class{constructor(form){this.values=form.values||{}}get(k){return this.values[k]}}};
 vm.createContext(ctx);return {ctx,nodes,storage,timers,run:p=>{vm.runInContext(fs.readFileSync(path.join(base,p),'utf8'),ctx,{filename:p});if(ctx.window.AppHttp)ctx.AppHttp=ctx.window.AppHttp;if(ctx.window.AdminSession)ctx.AdminSession=ctx.window.AdminSession;if(ctx.window.NotificationInbox)ctx.NotificationInbox=ctx.window.NotificationInbox;}};
}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const easy=fs.existsSync(path.join(base,'admin/index.html'));
 const h=harness(fs.readFileSync(path.join(base,easy?'admin/index.html':'web/index.html'),'utf8'));let calls=[];
 h.ctx.fetch=async(url,options={})=>{calls.push({url,options});return {ok:true,status:200,json:async()=>url.includes('admin-session.php')?{token:'signed-token',expiresAt:Math.floor(Date.now()/1000)+1800}:url.includes('notifications')?{notifications:[{id:42,order_id:7,order_ref:'ABC',message:'Update',read_at:null}],unreadCount:1}:{orders:[],partners:[]}}};
 h.run(easy?'shared/api-client.js':'web/api-client.js');h.run(easy?'shared/admin-session.js':'web/admin-session.js');h.run(easy?'shared/notifications.js':'web/notifications.js');
 await h.ctx.AdminSession.login('test-password');assert.equal(h.ctx.AdminSession.headers()['X-Admin-Session'],'signed-token');assert.equal(h.ctx.AdminSession.headers()['X-Admin-Password'],undefined);
 const dock=new h.ctx.NotificationInbox(new Element(),async()=>({notifications:[{id:42,order_id:7,message:'Update',read_at:null}],unreadCount:1}),async id=>{assert.equal(id,42)});dock.active=true;await dock.refresh();assert.equal(dock.title.textContent,'Notifications · 1 unread');await dock.save(42);dock.destroy();
 if(easy){
  const states=[['New',null],['Preparing','out_for_delivery'],['Delivered','delivered'],['Cancelled','cancelled']];
  h.ctx.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>url.includes('admin-orders')?{orders:states.map(([status,delivery_status],i)=>({public_id:'ORDER'+i,status,delivery_status,items:[],total:10.75,subtotal:10.75,delivery_fee:0,created_at:'2026-09-30',customer_name:'Test',mobile:'9876543210',house:'12',locality:'Lanka',city:'Varanasi',state:'UP',pin:'221005'}))}:{notifications:[],unreadCount:0}}};
  h.nodes.ordersFilter.value='All';h.run('admin/orders.js');await tick();await tick();
  assert.equal(h.nodes.ordersCount.textContent,'4 of 4 orders shown');
  for(const status of states.map(s=>s[0])){h.nodes.ordersFilter.value=status;await h.nodes.ordersFilter.fire('change');assert.equal(h.nodes.ordersCount.textContent,'1 of 4 orders shown');}
  const select=h.ctx.document.getElementById('ordersDeliveryFilter');select.value='out_for_delivery';await select.fire('input');assert.equal(h.nodes.ordersFilter.value,'All');assert.equal(h.nodes.ordersCount.textContent,'1 of 4 orders shown');
  select.value='created';await select.fire('change');assert.equal(h.nodes.ordersCount.textContent,'0 of 4 orders shown');assert.equal(h.ctx.document.getElementById('ordersEmpty').hidden,false);
  h.ctx.AdminSession.clear();assert.equal(h.ctx.AdminSession.token,null);assert.equal(h.nodes.ordersControls.hidden,true);
  // Execute customer checkout including WhatsApp confirmation with real production script.
  const c=harness(fs.readFileSync(path.join(base,'web/index.html'),'utf8'));const catalog=JSON.parse(fs.readFileSync(path.join(base,'assets/products.json')));catalog.store.minimumOrder=0;catalog.products[0].price=10.75;const id=catalog.products[0].id;
  c.ctx.fetch=async(url,options)=>({ok:true,status:200,json:async()=>({orderId:'ABC123',total:10.75}),text:async()=>JSON.stringify(catalog)});
  // Catalog calls expect JSON; order calls use the same response shape.
  c.ctx.fetch=async(url,options)=>({ok:true,status:200,json:async()=>url.includes('order-create')?{orderId:'ABC123',total:10.75}:catalog});
  c.run('shared/api-client.js');c.run('web/storefront.js');await tick();await tick();vm.runInContext(`change(${JSON.stringify(id)},1)`,c.ctx);
  c.nodes.orderForm.values={name:'Test User',phone:'9876543210',house:'House 12',locality:'Lanka',landmark:'',pin:'221005'};await c.nodes.orderForm.fire('submit');
  const link=c.nodes.orderConfirmation.children.find(n=>n.tagName==='a');assert.ok(link.href.startsWith('https://wa.me/917398564033?'));assert.ok(new URL(link.href).searchParams.get('text').includes('\n'));assert.equal(c.nodes.orderForm.hidden,true);
 }else{
  // Entire delivery application executes; admin inbox must never reference a deleted password.
  h.run('web/app.js');await tick();await tick();assert.ok(calls.some(c=>c.url.includes('audience=admin')));const call=calls.find(c=>c.url.includes('audience=admin'));assert.equal(call.options.headers['X-Admin-Session'],'signed-token');assert.equal(call.options.headers['X-Admin-Password'],undefined);
  await h.nodes.newPartner.fire('click');assert.equal(h.nodes.partnerDialog.open,true);
  h.nodes.partnerName.value='';h.nodes.partnerMobile.value='123';h.nodes.partnerPassword.value='short';await h.nodes.partnerForm.fire('submit');assert.ok(h.nodes.partnerMobileError.textContent);assert.equal(h.nodes.partnerDialog.open,true);
  h.ctx.fetch=async(url,options)=>{calls.push({url,options});const b=options?.body?JSON.parse(options.body):{};return {ok:true,status:200,json:async()=>b.operation==='partner-create'?{id:9}:b.operation==='list'?{orders:[],partners:[{id:9,name:'Test Partner',mobile:'9876543210',active:1}]}:{notifications:[],unreadCount:0}}};
  h.nodes.partnerName.value='Test Partner';h.nodes.partnerMobile.value='9876543210';h.nodes.partnerPassword.value='long-test-password';await h.nodes.partnerForm.fire('submit');
  assert.equal(h.nodes.partnerDialog.open,false);assert.ok(h.nodes.partnerFeedback.textContent.includes('created successfully'));assert.equal(h.nodes.partnerPassword.value,'');
  h.nodes.partnerSearch.value='no match';await h.nodes.partnerSearch.fire('input');assert.equal(h.nodes.partnerCount.textContent,'0 of 1 partners · 1 active');
  vm.runInContext('openPartner(partnerRecords[0])',h.ctx);h.nodes.partnerName.value='Updated Partner';h.nodes.partnerPassword.value='';await h.nodes.partnerForm.fire('submit');assert.ok(calls.some(c=>c.options.body&&JSON.parse(c.options.body).operation==='partner-update'));

 }
 if(!easy){
  const jobs=['assigned','out_for_delivery','delivered','cancelled'].map((status,i)=>({id:i+1,external_order_id:'R'+i,status,customer_name:'Customer',address_text:'Lanka',customer_mobile:'9876543210'}));
  h.ctx.fetch=async()=>({ok:true,status:200,json:async()=>({orders:jobs,notifications:[]})});
  await vm.runInContext('loadPartner()',h.ctx);
  const buttons=h.nodes.partnerOrders.children.map(card=>card.children.find(n=>n.textContent==='Call customer'));
  assert.equal(buttons[0].disabled,false);assert.equal(buttons[1].disabled,false);assert.equal(buttons[2].disabled,true);assert.equal(buttons[3].disabled,true);
  const adminOrder={id:7,external_order_id:'TEST-7',customer_name:'Customer',address_text:'Lanka',partner_id:9,status:'out_for_delivery'};
  h.ctx.fetch=async(url,options)=>({ok:true,status:200,json:async()=>({orders:[adminOrder],partners:[{id:9,name:'Current',mobile:'9876543210',active:1},{id:10,name:'Replacement',mobile:'9876543211',active:1}]})});
  await vm.runInContext('loadAdmin()',h.ctx);
  const change=h.nodes.adminOrders.children[0].children.find(n=>n.textContent==='Change delivery partner');assert.ok(change);assert.equal(change.disabled,false);
  adminOrder.status='delivered';await vm.runInContext('loadAdmin()',h.ctx);assert.equal(h.nodes.adminOrders.children[0].children.find(n=>n.textContent==='Change delivery partner').disabled,true);
 }
 console.log((easy?'Easy Mandi':'Delivery')+' session, notifications and feature regressions passed');
})().catch(e=>{console.error(e);process.exitCode=1});

