(() => {
  'use strict';
  window.NotificationInbox=class{
    constructor(root,load,mark,open){
      Object.assign(this,{
        root,load,mark,open,active:false,loading:false,seen:new Set(),data:{
          notifications:[],unreadCount:0
        }
      });
      this.lockedMessage=root.closest('#ordersPanel, #admin')?'Enter the admin password once for 30 minutes of automatic updates.':'Sign in to see your notifications.';
      this.dock=document.createElement('aside');
      this.dock.className='notification-dock';
      this.dock.setAttribute('aria-label','Notifications');
      this.dock.setAttribute('aria-live','polite');
      const head=document.createElement('header');
      this.title=document.createElement('strong');
      this.title.textContent='Notifications';
      const expand=document.createElement('button');
      expand.type='button';
      expand.textContent='View all';
      expand.onclick=()=>this.show();
      head.append(this.title,expand);
      const hintedRole=String(root.id||'').match(/^(admin|customer|partner)Notifications$/)?.[1];
      const role=hintedRole||(window.location?.pathname?.includes('/admin/')?'admin':'customer');
      this.preferences=new window.NotificationPreferences(role);
      const settings=document.createElement('button');
      settings.type='button';
      settings.className='notification-settings-toggle';
      settings.textContent='⚙ Settings';
      settings.title='Customize sounds, vibration and mute for each notification type';
      settings.setAttribute('aria-label','Notification sound and vibration settings');
      settings.onclick=()=>this.preferences.open();
      head.append(settings);

      const moveHandle=document.createElement('button');
      moveHandle.type='button';
      moveHandle.className='notification-move-handle';
      moveHandle.textContent='⠿';
      moveHandle.title='Drag to move notifications · Arrow keys to move · Double-click to reset';
      moveHandle.setAttribute('aria-label','Move notification box: drag or press arrow keys. Double-click to reset position.');
      head.prepend(moveHandle);
      this.preview=document.createElement('div');
      this.preview.className='notification-preview';
      this.preview.textContent=this.lockedMessage;
      this.dock.append(head,this.preview);
      document.body.append(this.dock);

      // Keep the compact notification box movable without interfering with its buttons.
      // Each role has its own browser-local position; no server or account data changes.
      this.dockPositionKey='easy-mandi-notification-position-v1-'+role;
      const placeDock=(x,y)=>{
        const pad=8;
        const left=Math.max(pad,Math.min(x,Math.max(pad,window.innerWidth-this.dock.offsetWidth-pad)));
        const top=Math.max(pad,Math.min(y,Math.max(pad,window.innerHeight-this.dock.offsetHeight-pad)));
        Object.assign(this.dock.style,{left:left+'px',top:top+'px',right:'auto',bottom:'auto'});
        this.dockPosition={x:left,y:top};
      };
      const saveDock=()=>{
        if(!this.dockPosition)return;
        try { localStorage.setItem(this.dockPositionKey,JSON.stringify(this.dockPosition)); }
        catch (_) { /* Browser storage may be disabled. */ }
      };
      try {
        const saved=JSON.parse(localStorage.getItem(this.dockPositionKey)||'null');
        if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))placeDock(saved.x,saved.y);
      } catch (_) { /* Use default bottom-right position. */ }
      this.onDockResize=()=>{if(this.dockPosition){placeDock(this.dockPosition.x,this.dockPosition.y);saveDock();}};
      window.addEventListener('resize',this.onDockResize);
      let dockDrag=null;
      moveHandle.addEventListener('pointerdown',event=>{
        if(event.button!==0||this.dock.hidden)return;
        const rect=this.dock.getBoundingClientRect();
        dockDrag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
        moveHandle.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
      moveHandle.addEventListener('pointermove',event=>{
        if(!dockDrag||dockDrag.id!==event.pointerId)return;
        placeDock(dockDrag.left+event.clientX-dockDrag.x,dockDrag.top+event.clientY-dockDrag.y);
      });
      const finishDockDrag=event=>{
        if(!dockDrag||dockDrag.id!==event.pointerId)return;
        dockDrag=null;
        saveDock();
      };
      moveHandle.addEventListener('pointerup',finishDockDrag);
      moveHandle.addEventListener('pointercancel',finishDockDrag);
      moveHandle.addEventListener('lostpointercapture',finishDockDrag);
      moveHandle.addEventListener('keydown',event=>{
        const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];
        if(!delta)return;
        event.preventDefault();
        const rect=this.dock.getBoundingClientRect();
        placeDock(rect.left+delta[0],rect.top+delta[1]);
        saveDock();
      });
      moveHandle.addEventListener('dblclick',()=>{
        dockDrag=null;
        this.dockPosition=null;
        Object.assign(this.dock.style,{left:'',top:'',right:'',bottom:''});
        try { localStorage.removeItem(this.dockPositionKey); } catch (_) {}
      });
      this.dialog=document.createElement('dialog');
      this.dialog.className='notification-modal';
      this.dialog.setAttribute('aria-label','Notification history');
      const close=document.createElement('button');
      close.type='button';
      close.textContent='Close';
      close.onclick=()=>this.dialog.close();
      this.list=document.createElement('section');
      this.dialog.append(close,this.list);
      document.body.append(this.dialog);
      this.view=root.closest('.view');
      this.syncView=()=>{
        this.dock.hidden=!!this.view?.hidden;
      };
      if(this.view){
        this.observer=new MutationObserver(this.syncView);
        this.observer.observe(this.view,{
          attributes:true,attributeFilter:['hidden']
        });
      }
      this.syncView();
      this.timer=setInterval(()=>{
        if(this.active&&!document.hidden)this.refresh().catch(()=>{
          this.preview.textContent='Could not check updates. Retrying automatically.';
        });
      },300000);
      this.root.replaceChildren();
      this.list.textContent=this.lockedMessage;
    }
    destroy(){
      this.stop();
      clearInterval(this.timer);
      this.observer?.disconnect();
      window.removeEventListener('resize',this.onDockResize);
      this.dock.remove();
      this.dialog.remove();
      this.preferences.destroy();
    }
    show(){
      if(!this.dialog.open)this.dialog.showModal();
    }
    stop(){
      this.active=false;
      this.seen.clear();
      this.lastFingerprint=undefined;
      this.lastIds=new Set();
      this.data={
        notifications:[],unreadCount:0
      };
      this.title.textContent='Notifications';
      this.preview.textContent=this.lockedMessage;
      this.list.replaceChildren();
      this.list.textContent=this.lockedMessage;
      if(this.dialog.open)this.dialog.close();
      this.root.replaceChildren();
    }
    async refresh(){
      if(this.loading)return;
      this.loading=true;
      try{
        const data=await this.load();
        if(!this.active)return;
        this.render(data);
      }finally{
        this.loading=false;
      }
    }
    render(data){
      const fingerprint=JSON.stringify((data.notifications||[]).map(n=>[n.id,n.message,n.read_at]));
      const previous=this.lastFingerprint;
      const changed=previous!==undefined&&previous!==fingerprint;
      const lastIds=this.lastIds||new Set();
      const noticeKey=n=>String(n.audience||n._audience||'')+':'+String(n.id);
      const newIds=new Set((data.notifications||[]).map(noticeKey));
      const freshIds=new Set(previous===undefined?[]:(data.notifications||[]).filter(n=>!n.read_at&&!lastIds.has(noticeKey(n))).map(noticeKey));
      const incoming=freshIds.size>0;
      this.lastFingerprint=fingerprint;
      this.lastIds=newIds;
      if(changed){
        this.dock.classList.remove('notification-updated');
        void this.dock.offsetWidth;
        this.dock.classList.add('notification-updated');
        if(this.counts){
          this.counts.classList.remove('notification-bounce');
          void this.counts.offsetWidth;
          this.counts.classList.add('notification-bounce');
        }
        if(incoming)this.preferences.notify((data.notifications||[]).filter(n=>freshIds.has(String(n.audience||n._audience||'')+':'+String(n.id))));
      }
      this.data=data;
      this.title.textContent='Notifications · '+data.unreadCount+' unread';
      const unread=data.notifications.filter(n=>!n.read_at);
      this.preview.textContent=(unread.length?unread:data.notifications).slice(0,3).map(n=>n.message).join('\n\n')||'No notifications yet.';
      this.list.replaceChildren();
      const heading=document.createElement('h2');
      heading.textContent=this.title.textContent;
      this.list.append(heading);
      const all=document.createElement('button');
      all.type='button';
      all.textContent='Mark all as read';
      all.disabled=!data.unreadCount;
      all.onclick=()=>this.save(null);
      this.list.append(all);
      if(!data.notifications.length){
        const p=document.createElement('p');
        p.textContent='No notifications yet.';
        this.list.append(p);
      }
      for(const n of data.notifications){
        const row=document.createElement('article');
        if(freshIds.has(noticeKey(n)))row.classList.add('notification-entry-new');
        row.style.background=n.read_at?'white':'#e8f2fc';
        const p=document.createElement('p');
        p.textContent=(n.read_at?'':'Unread · ')+n.message;
        const time=document.createElement('small');
        time.textContent=n.created_at;
        row.append(p,time);
        if(this.open){
          const b=document.createElement('button');
          b.type='button';
          b.textContent='Open order';
          b.onclick=()=>{
            this.dialog.close();
            this.open(n);
          };
          row.append(b);
        }
        if(!n.read_at){
          const b=document.createElement('button');
          b.type='button';
          b.textContent='Mark as read';
          b.onclick=()=>this.save(Number(n.id),n);
          row.append(b);
        }this.list.append(row);
      }
    }
    async save(id,n){
      try{
        await this.mark(id,n);
        await this.refresh();
      }catch(e){
        const p=document.createElement('p');
        p.setAttribute('role','alert');
        p.textContent=e.message||'Could not save. Please retry.';
        this.list.append(p);
      }
    }
  };
})();
