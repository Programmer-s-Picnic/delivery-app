(() => {
  const key='easy-mandi-admin-session-v1';
  let timer;
  function clear(){
    sessionStorage.removeItem(key);
    clearTimeout(timer);
    window.dispatchEvent(new Event('admin-session-ended'));
  }
  function get(){
    let value;
    try{
      value=JSON.parse(sessionStorage.getItem(key));
    }catch{
    }if(!value?.token||!Number.isFinite(value.expiresAt)||Date.now()>=value.expiresAt){
      if(value)clear();
      return null;
    }return value;
  }
  function schedule(){
    clearTimeout(timer);
    const s=get();
    if(s)timer=setTimeout(clear,Math.max(0,s.expiresAt-Date.now()));
  }
  window.AdminSession={
    get token(){
      return get()?.token||null;
    },
    get expiresAt(){
      return get()?.expiresAt||0;
    },
    clear,
    async login(password){
      const r=await AppHttp.fetch('https://cserver.learnwithchampak.live/easymandi/api/admin-session.php',{
        method:'POST',cache:'no-store',headers:{
          'Content-Type':'application/json','X-Admin-Password':password
        },body:'{}'
      });
      const data=await r.json();
      if(!r.ok)throw Error(data.error||'Could not start admin session.');
      sessionStorage.setItem(key,JSON.stringify({
        token:data.token,expiresAt:data.expiresAt*1000
      }));
      schedule();
      window.dispatchEvent(new Event('admin-session-started'));
      return data;
    },
    headers(){
      const s=get();
      if(!s)throw Error('Your 30-minute admin session has ended. Enter the admin password again.');
      return {
        'X-Admin-Session':s.token
      };
    }
  };
  schedule();
})();
