(() => {
  'use strict';
  const types = [
    ['order_new','New orders'],
    ['order_confirmed','Order accepted'],
    ['order_preparing','Order being prepared'],
    ['order_delivered','Order delivered'],
    ['order_cancelled','Order cancelled'],
    ['payment_pending','Payment / receipt submitted'],
    ['payment_verified','Payment confirmed'],
    ['payment_problem','Payment problem'],
    ['delivery_assigned','Delivery assigned / reassigned'],
    ['delivery_picked_up','Delivery picked up'],
    ['delivery_out','Out for delivery'],
    ['handoff_code','Customer handoff code'],
    ['general','Other updates']
  ];
  const melodies = {
    none:[],
    chime:[[659,110],[880,210]],
    bell:[[988,170],[784,170],[988,220]],
    ping:[[880,150]],
    double:[[620,100],[0,75],[620,100]],
    alert:[[740,130],[0,80],[740,130],[0,80],[740,200]]
  };
  const sounds={none:'None',chime:'Chime',bell:'Bell',ping:'Ping',double:'Double beep',alert:'Alert'};
  function classify(notification) {
    const explicit=String(notification.type||notification.notification_type||'').toLowerCase();
    if(types.some(([key])=>key===explicit))return explicit;
    const m=String(notification.message||'').toLowerCase();
    if(/code|otp|handoff|verification pin/.test(m))return 'handoff_code';
    if(/payment|receipt|upi|cod|paid|refund/.test(m)) {
      if(/failed|rejected|declined|problem|invalid/.test(m))return 'payment_problem';
      if(/verified|approved|confirmed|received|marked paid|successful/.test(m))return 'payment_verified';
      return 'payment_pending';
    }
    if(/reassigned|assigned|partner changed|delivery person changed/.test(m))return 'delivery_assigned';
    if(/out for delivery/.test(m))return 'delivery_out';
    if(/picked up|pickup/.test(m))return 'delivery_picked_up';
    if(/cancelled|canceled/.test(m))return 'order_cancelled';
    if(/delivered|completed|handover complete/.test(m))return 'order_delivered';
    if(/preparing|being prepared|packed/.test(m))return 'order_preparing';
    if(/accepted|confirmed/.test(m))return 'order_confirmed';
    if(/placed|created|new order/.test(m))return 'order_new';
    return 'general';
  }
  let audioContext;
  async function play(name) {
    if(!melodies[name]||!melodies[name].length)return;
    const Constructor=window.AudioContext||window.webkitAudioContext;
    if(!Constructor)return;
    try {
      audioContext ||= new Constructor();
      if(audioContext.state==='suspended')await audioContext.resume();
      let cursor=audioContext.currentTime+0.008;
      for(const [hz,ms] of melodies[name]) {
        const duration=ms/1000;
        if(hz>0){
          const osc=audioContext.createOscillator(),gain=audioContext.createGain();
          osc.type='sine';osc.frequency.setValueAtTime(hz,cursor);
          gain.gain.setValueAtTime(0.0001,cursor);
          gain.gain.exponentialRampToValueAtTime(0.07,cursor+0.018);
          gain.gain.exponentialRampToValueAtTime(0.0001,cursor+duration);
          osc.connect(gain);gain.connect(audioContext.destination);
          osc.start(cursor);osc.stop(cursor+duration+0.01);
        }
        cursor+=duration;
      }
    } catch (_) { /* Browsers may require a gesture before playing sound. */ }
  }
  class NotificationPreferences {
    constructor(role='customer') {
      this.role=['admin','customer','partner'].includes(role)?role:'customer';
      this.key='easy-mandi-notice-settings-v1-'+this.role;
      let saved={};
      try { saved=JSON.parse(localStorage.getItem(this.key)||'{}')||{}; } catch (_) {}
      this.masterMute=!!saved.masterMute;
      this.rules={};
      for(const [type] of types){
        const value=saved.rules?.[type]||{};
        this.rules[type]={
          mute:!!value.mute,
          vibration:!!value.vibration,
          sound:Object.hasOwn(sounds,value.sound)?value.sound:'none'
        };
      }
    }
    save(){
      try { localStorage.setItem(this.key,JSON.stringify({masterMute:this.masterMute,rules:this.rules})); }
      catch (_) { /* Private browsing can disallow persistence. */ }
    }
    notify(fresh){
      if(this.masterMute)return;
      const events=new Set(fresh.filter(n=>!n.read_at).map(classify));
      for(const type of events) {
        const setting=this.rules[type];
        if(setting.mute)continue;
        if(setting.sound!=='none')void play(setting.sound);
        if(setting.vibration && typeof navigator!=='undefined' && typeof navigator.vibrate==='function')
          try { navigator.vibrate([130,80,130]); } catch (_) {}
      }
    }
    open(){
      if(this.dialog?.open)return;
      if(!this.dialog){
        const d=document.createElement('dialog');
        d.className='notification-settings-dialog';
        d.setAttribute('aria-label','Notification settings for '+this.role);
        const title=document.createElement('h2');
        title.textContent='Notification settings · '+({admin:'Admin',customer:'Customer',partner:'Delivery partner'}[this.role]);
        const helper=document.createElement('p');
        helper.textContent='These controls affect sound and vibration, not the notification history. Saved on this device and browser. Sound works after you interact with this page; vibration depends on device and browser support.';
        const master=document.createElement('label');
        master.className='notice-settings-master';
        const masterSwitch=document.createElement('input');
        masterSwitch.type='checkbox';masterSwitch.checked=this.masterMute;
        masterSwitch.onchange=()=>{this.masterMute=masterSwitch.checked;this.save();};
        master.append(masterSwitch,document.createTextNode(' Mute all alerts (keep messages visible)'));
        const rows=document.createElement('div');rows.className='notice-settings-rows';
        for(const [type,label] of types){
          const row=document.createElement('section');row.className='notice-settings-row';
          const name=document.createElement('strong');name.textContent=label;
          const muteLabel=document.createElement('label');
          const mute=document.createElement('input');mute.type='checkbox';mute.checked=this.rules[type].mute;
          mute.onchange=()=>{this.rules[type].mute=mute.checked;this.save();};
          muteLabel.append(mute,document.createTextNode(' Mute'));
          const vibrateLabel=document.createElement('label');
          const vibrate=document.createElement('input');vibrate.type='checkbox';vibrate.checked=this.rules[type].vibration;
          vibrate.onchange=()=>{this.rules[type].vibration=vibrate.checked;this.save();};
          vibrateLabel.append(vibrate,document.createTextNode(' Vibrate'));
          const soundLabel=document.createElement('label');soundLabel.textContent='Sound ';
          const sound=document.createElement('select');
          sound.setAttribute('aria-label','Sound for '+label);
          for(const [id,title] of Object.entries(sounds)){
            const option=document.createElement('option');option.value=id;option.textContent=title;sound.append(option);
          }
          sound.value=this.rules[type].sound;
          sound.onchange=()=>{this.rules[type].sound=sound.value;this.save();void play(sound.value);};
          soundLabel.append(sound);
          const preview=document.createElement('button');preview.type='button';preview.textContent='▶ Test';
          preview.setAttribute('aria-label','Test sound for '+label);
          preview.onclick=()=>{if(vibrate.checked&&typeof navigator!=='undefined'&&typeof navigator.vibrate==='function')navigator.vibrate([100,70,100]);void play(sound.value);};
          row.append(name,muteLabel,vibrateLabel,soundLabel,preview);rows.append(row);
        }
        const footer=document.createElement('div');footer.className='notice-settings-footer';
        const close=document.createElement('button');close.type='button';close.textContent='Done';close.onclick=()=>d.close();
        footer.append(close);
        d.append(title,helper,master,rows,footer);document.body.append(d);
        this.dialog=d;
      }
      this.dialog.showModal();
    }
    destroy(){this.dialog?.remove();}
  }
  window.NotificationPreferences=NotificationPreferences;
  window.classifyEasyMandiNotification=classify;
})();