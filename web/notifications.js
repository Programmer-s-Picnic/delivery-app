(() => {
 'use strict';
 const style=document.createElement('style');
 style.textContent=`
 .notification-dock{position:fixed;bottom:12px;right:12px;width:min(360px,calc(100vw - 24px));z-index:10000;background:white;color:#18364d;border:1px solid #b5c9db;border-radius:14px;box-shadow:0 5px 24px #18364d33;padding:12px;font:14px system-ui}
 .notification-dock header{padding:0;background:white;border:0;display:flex;align-items:center;justify-content:space-between;gap:8px}
 .notification-dock button,.notification-modal button{border:0;border-radius:8px;padding:9px;background:#126dba;color:white;font:inherit;cursor:pointer}
 .notification-preview{max-height:110px;overflow:auto;margin-top:8px;white-space:pre-line}
 .notification-modal{width:min(620px,calc(100vw - 24px));max-height:80vh;overflow:auto;border:1px solid #b5c9db;border-radius:16px;padding:20px;color:#18364d;background:white}
 .notification-modal::backdrop{background:#18364d66}
 .notification-modal article{padding:12px;margin:8px 0;border:1px solid #b5c9db;border-radius:10px}
 body{padding-bottom:210px!important}
 `;document.head.append(style);
 window.NotificationInbox=class{
 constructor(root,load,mark,open){
  Object.assign(this,{root,load,mark,open,active:false,loading:false,seen:new Set(),data:{notifications:[],unreadCount:0}});
  this.lockedMessage=root.closest('#ordersPanel, #admin')?'Enter the admin password once for 30 minutes of automatic updates.':'Sign in to see your notifications.';
  this.dock=document.createElement('aside');this.dock.className='notification-dock';this.dock.setAttribute('aria-label','Notifications');this.dock.setAttribute('aria-live','polite');
  const head=document.createElement('header');this.title=document.createElement('strong');this.title.textContent='Notifications';
  const expand=document.createElement('button');expand.type='button';expand.textContent='View all';expand.onclick=()=>this.show();
  head.append(this.title,expand);this.preview=document.createElement('div');this.preview.className='notification-preview';this.preview.textContent=this.lockedMessage;
  this.dock.append(head,this.preview);document.body.append(this.dock);
  this.dialog=document.createElement('dialog');this.dialog.className='notification-modal';this.dialog.setAttribute('aria-label','Notification history');
  const close=document.createElement('button');close.type='button';close.textContent='Close';close.onclick=()=>this.dialog.close();
  this.list=document.createElement('section');this.dialog.append(close,this.list);document.body.append(this.dialog);
  this.view=root.closest('.view');
  this.syncView=()=>{this.dock.hidden=!!this.view?.hidden;};
  if(this.view)new MutationObserver(this.syncView).observe(this.view,{attributes:true,attributeFilter:['hidden']});
  this.syncView();this.timer=setInterval(()=>{if(this.active)this.refresh().catch(()=>{this.preview.textContent='Could not check updates. Retrying automatically.';});},300000);
  this.root.replaceChildren();this.list.textContent=this.lockedMessage;
 }
 show(){if(!this.dialog.open)this.dialog.showModal();}
 stop(){this.active=false;this.seen.clear();this.data={notifications:[],unreadCount:0};this.title.textContent='Notifications';this.preview.textContent=this.lockedMessage;this.list.replaceChildren();this.list.textContent=this.lockedMessage;if(this.dialog.open)this.dialog.close();this.root.replaceChildren();}
 async refresh(){if(this.loading)return;this.loading=true;try{const data=await this.load();if(!this.active)return;this.render(data);}finally{this.loading=false;}}
 render(data){
  this.data=data;this.title.textContent='Notifications · '+data.unreadCount+' unread';
  const unread=data.notifications.filter(n=>!n.read_at);
  this.preview.textContent=(unread.length?unread:data.notifications).slice(0,3).map(n=>n.message).join('\n\n')||'No notifications yet.';
  this.list.replaceChildren();const heading=document.createElement('h2');heading.textContent=this.title.textContent;this.list.append(heading);
  const all=document.createElement('button');all.type='button';all.textContent='Mark all as read';all.disabled=!data.unreadCount;all.onclick=()=>this.save(null);this.list.append(all);
  if(!data.notifications.length){const p=document.createElement('p');p.textContent='No notifications yet.';this.list.append(p);}
  for(const n of data.notifications){
   const row=document.createElement('article');row.style.background=n.read_at?'white':'#e8f2fc';const p=document.createElement('p');p.textContent=(n.read_at?'':'Unread · ')+n.message;
   const time=document.createElement('small');time.textContent=n.created_at;row.append(p,time);
   if(this.open){const b=document.createElement('button');b.type='button';b.textContent='Open order';b.onclick=()=>{this.dialog.close();this.open(n);};row.append(b);}
   if(!n.read_at){const b=document.createElement('button');b.type='button';b.textContent='Mark as read';b.onclick=()=>this.save(Number(n.id),n);row.append(b);}this.list.append(row);
  }
 }
 async save(id,n){try{await this.mark(id,n);await this.refresh();}catch(e){const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=e.message||'Could not save. Please retry.';this.list.append(p);}}
 };
})();

(() => {
 const key='easy-mandi-admin-session-v1';
 let timer;
 function clear(){sessionStorage.removeItem(key);clearTimeout(timer);window.dispatchEvent(new Event('admin-session-ended'));}
 function get(){let value;try{value=JSON.parse(sessionStorage.getItem(key));}catch{}if(!value?.token||!Number.isFinite(value.expiresAt)||Date.now()>=value.expiresAt){if(value)clear();return null;}return value;}
 function schedule(){clearTimeout(timer);const s=get();if(s)timer=setTimeout(clear,Math.max(0,s.expiresAt-Date.now()));}
 window.AdminSession={
  get token(){return get()?.token||null;},
  get expiresAt(){return get()?.expiresAt||0;},
  clear,
  async login(password){
   const r=await fetch('https://cserver.learnwithchampak.live/easymandi/api/admin-session.php',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Admin-Password':password},body:'{}'});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Could not start admin session.');
   sessionStorage.setItem(key,JSON.stringify({token:data.token,expiresAt:data.expiresAt*1000}));
   schedule();window.dispatchEvent(new Event('admin-session-started'));return data;
  },
  headers(){const s=get();if(!s)throw Error('Your 30-minute admin session has ended. Enter the admin password again.');return {'X-Admin-Session':s.token};}
 };
 schedule();
})();
