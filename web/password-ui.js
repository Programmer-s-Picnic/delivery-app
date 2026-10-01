(() => {
 const target=document.getElementById('adminArea')||document.querySelector('.toolbar');if(!target)return;
 const launch=document.createElement('button');launch.type='button';launch.className='btn secondary';launch.textContent='Change admin password';target.prepend(launch);
 const dialog=document.createElement('dialog');dialog.className='admin-password-dialog';dialog.setAttribute('aria-label','Change administrator password');
 const form=document.createElement('form');const title=document.createElement('h2');title.textContent='Change administrator password';form.append(title);
 const fields={};for(const [key,label,auto] of [['currentPassword','Current password','current-password'],['newPassword','New password (12–256 characters)','new-password'],['confirmation','Confirm new password','new-password']]){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.type='password';input.autocomplete=auto;input.required=true;input.maxLength=256;if(key!=='currentPassword')input.minLength=12;fields[key]=input;wrap.append(input);form.append(wrap);}
 const message=document.createElement('p');message.setAttribute('role','status');form.append(message);
 const cancel=document.createElement('button');cancel.type='button';cancel.className='btn secondary';cancel.textContent='Close';cancel.onclick=()=>dialog.close();
 const submit=document.createElement('button');submit.type='submit';submit.className='btn';submit.textContent='Change password';form.append(cancel,submit);dialog.append(form);document.body.append(dialog);
 launch.onclick=async()=>{if(!window.AdminSession.token&&window.AdminAccess){try{await window.AdminAccess.ensure();}catch{return;}}message.textContent='Changing this shared password ends existing administrator sessions.';submit.hidden=false;dialog.showModal();fields.currentPassword.focus();};
 dialog.addEventListener('close',()=>{for(const input of Object.values(fields))input.value='';});
 form.onsubmit=async e=>{e.preventDefault();if(fields.newPassword.value!==fields.confirmation.value){message.textContent='The new passwords do not match.';return;}
 submit.disabled=true;cancel.disabled=true;message.textContent='Saving…';
 try{const headers=window.AdminSession.headers();const r=await AppHttp.fetch('https://cserver.learnwithchampak.live/easymandi/api/admin-password.php',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value])))});const result=await r.json();if(!r.ok)throw Error(result.error||'Could not change password.');for(const input of Object.values(fields))input.value='';window.AdminSession.clear();message.textContent=result.message;submit.hidden=true;}
 catch(error){message.textContent=error.message||'Could not change password.';}finally{submit.disabled=false;cancel.disabled=false;}
 };
})();
