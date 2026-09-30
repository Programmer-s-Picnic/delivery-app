(() => {
 'use strict';
 window.NotificationInbox = class {
  constructor(root,load,mark,open){this.root=root;this.load=load;this.mark=mark;this.open=open;this.active=false;this.loading=false;this.seen=new Set();this.banner=document.createElement('aside');this.banner.setAttribute('role','status');this.banner.style.cssText='position:fixed;top:12px;left:12px;right:12px;z-index:10000;background:#e8f2fc;color:#18364d;border:1px solid #b5c9db;padding:16px;border-radius:12px;box-shadow:0 4px 20px #18364d22';this.banner.hidden=true;document.body.append(this.banner);this.timer=setInterval(()=>{if(this.active)this.refresh().catch(()=>{});},300000);}
  stop(){this.active=false;this.seen.clear();this.banner.hidden=true;this.root.replaceChildren();}
  async refresh(){if(this.loading)return;this.loading=true;try{const data=await this.load();if(!this.active)return;const fresh=data.notifications.filter(n=>!n.read_at&&!this.seen.has(String(n.id)));for(const n of data.notifications)this.seen.add(String(n.id));if(fresh.length){this.banner.textContent=fresh.length+' new notification'+(fresh.length===1?'':'s')+' · '+fresh[0].message;this.banner.hidden=false;clearTimeout(this.hideTimer);this.hideTimer=setTimeout(()=>{this.banner.hidden=true;},20000);}this.render(data);}finally{this.loading=false;}}
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
