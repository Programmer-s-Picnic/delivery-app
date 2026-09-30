(() => {
 'use strict';
 window.NotificationInbox = class {
  constructor(root,load,mark,open){this.root=root;this.load=load;this.mark=mark;this.open=open;this.active=false;this.loading=false;this.timer=setInterval(()=>{if(this.active&&!document.hidden)this.refresh().catch(()=>{});},30000);}
  stop(){this.active=false;this.root.replaceChildren();}
  async refresh(){if(this.loading)return;this.loading=true;try{const data=await this.load();if(!this.active)return;this.render(data);}finally{this.loading=false;}}
  render(data){this.root.replaceChildren();const title=document.createElement('h3');title.textContent='Notifications · '+data.unreadCount+' unread';this.root.append(title);
   const all=document.createElement('button');all.textContent='Mark all as read';all.disabled=!data.unreadCount;all.onclick=()=>this.save(null);this.root.append(all);
   if(!data.notifications.length){const p=document.createElement('p');p.textContent='No notifications yet.';this.root.append(p);}
   for(const n of data.notifications){const row=document.createElement('article');row.style.cssText='padding:12px;margin:8px 0;border:1px solid #b5c9db;border-radius:10px;background:'+(n.read_at?'#fff':'#e8f2fc');const p=document.createElement('p');p.textContent=(n.read_at?'':'Unread · ')+n.message;const time=document.createElement('small');time.textContent=n.created_at;row.append(p,time);
    if(this.open){const b=document.createElement('button');b.textContent='Open order';b.onclick=()=>this.open(n);row.append(b);}
    if(!n.read_at){const b=document.createElement('button');b.textContent='Mark as read';b.onclick=()=>this.save(Number(n.id));row.append(b);}this.root.append(row);
   }
  }
  async save(id){try{await this.mark(id);await this.refresh();}catch(e){const p=document.createElement('p');p.textContent=e.message||'Could not save. Please retry.';this.root.append(p);}}
 };
})();
