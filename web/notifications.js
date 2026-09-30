(() => {
 'use strict';
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
  if(this.view){this.observer=new MutationObserver(this.syncView);this.observer.observe(this.view,{attributes:true,attributeFilter:['hidden']});}
  this.syncView();this.timer=setInterval(()=>{if(this.active&&!document.hidden)this.refresh().catch(()=>{this.preview.textContent='Could not check updates. Retrying automatically.';});},300000);
  this.root.replaceChildren();this.list.textContent=this.lockedMessage;
 }
 destroy(){this.stop();clearInterval(this.timer);this.observer?.disconnect();this.dock.remove();this.dialog.remove();}
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

