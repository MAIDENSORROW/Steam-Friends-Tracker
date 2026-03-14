let currentFriends=[],searchQuery='',currentRadioUrl='',isTheme18Plus=false;

function formatDate(ts){
  const d=new Date(ts),n=new Date();
  const today=d.toDateString()===n.toDateString();
  const yest=new Date(n-86400000).toDateString()===d.toDateString();
  const t=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  if(today)return`Сегодня, ${t}`;
  if(yest)return`Вчера, ${t}`;
  return`${d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}, ${t}`;
}

function createFriendItem(f,type){
  const cls=type==='new'?'status-new':'status-removed';
  const txt=type==='new'?'+ Новый':'− Удалён';
  const icon=type==='new'?'↑':'↓';
  const ava=f.avatar||'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';
  return`<div class="friend-item"><img class="friend-avatar" src="${ava}"><div class="friend-info"><a class="friend-name" href="${f.url||f.profileUrl}" target="_blank">${esc(f.name)}</a><div class="friend-steamid">${f.id}</div></div><span class="friend-status ${cls}">${icon} ${txt}</span></div>`;
}

function esc(t){if(!t)return'';const d=document.createElement('div');d.textContent=t;return d.innerHTML;}

function filterFriends(friends){
  if(!searchQuery)return friends;
  const q=searchQuery.toLowerCase();
  return friends.filter(f=>f.name.toLowerCase().includes(q)||f.id.includes(q));
}

function renderFriends(){
  const c=document.getElementById('friends-list');
  if(!c)return;
  chrome.storage.local.get(['lastFriendsList'],(res)=>{
    currentFriends=res.lastFriendsList||[];
    const filtered=filterFriends(currentFriends);
    if(!filtered.length){
      c.innerHTML=`<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Друзей не найдено</div><div class="empty-hint">${searchQuery?'Попробуйте другой запрос':'Зайдите на страницу друзей в Steam~'}</div></div>`;
      return;
    }
    let h='';
    filtered.forEach((f,i)=>{h+=`<div class="friend-item" style="animation-delay:${i*0.05}s"><img class="friend-avatar" src="${f.avatar||'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'}"><div class="friend-info"><a class="friend-name" href="${f.url||f.profileUrl}" target="_blank">${esc(f.name)}</a><div class="friend-steamid">${f.id}</div></div></div>`;});
    c.innerHTML=h;updateStats();
  });
}

function renderHistory(){
  const c=document.getElementById('history-list');
  if(!c)return;
  chrome.storage.local.get(['logs'],(res)=>{
    const logs=res.logs||[];
    if(!logs.length){c.innerHTML=`<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">История пуста</div><div class="empty-hint">Изменения появятся здесь~</div></div>`;return;}
    let h='';
    logs.forEach((log,i)=>{
      const ad=log.new?.length||0,rm=log.removed?.length||0;
      if(ad===0&&rm===0)return;
      h+=`<div class="log-entry" style="animation-delay:${i*0.05}s"><div class="log-header"><span class="log-date">📅 ${formatDate(log.date)}</span><div>${ad>0?`<span class="log-added">+${ad}</span>`:''}${rm>0?`<span class="log-removed">−${rm}</span>`:''}</div></div></div>`;
    });
    c.innerHTML=h;
  });
}

function updateStats(){
  chrome.storage.local.get(['logs','lastFriendsList'],(res)=>{
    const logs=res.logs||[],list=res.lastFriendsList||[];
    let a=0,b=0;logs.forEach(l=>{a+=l.new?.length||0;b+=l.removed?.length||0;});
    document.getElementById('stat-added').textContent=a;
    document.getElementById('stat-removed').textContent=b;
    document.getElementById('stat-current').textContent=list.length;
    document.getElementById('stat-logs').textContent=logs.length;
  });
}

function notify(txt){
  const n=document.createElement('div');
  n.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:14px 28px;border-radius:15px;background:rgba(0,0,0,0.9);color:#fff;font-weight:800;z-index:10000;animation:slideDown 0.4s ease';
  n.textContent=txt;document.body.appendChild(n);
  setTimeout(()=>n.remove(),3000);
}

function initRadio(){
  const statusEl=document.getElementById('radio-status');
  document.querySelectorAll('.radio-station-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const url=btn.dataset.url;currentRadioUrl=url;
      document.querySelectorAll('.radio-station-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('radio-player').classList.add('active');
      chrome.runtime.sendMessage({type:'PLAY_RADIO',url},(r)=>{
        if(chrome.runtime.lastError){statusEl.textContent='❌ Ошибка';return;}
        statusEl.textContent='📻 Играет~';notify('Радио включено!');
      });
    });
  });
  document.getElementById('radio-play').addEventListener('click',()=>{
    if(!currentRadioUrl){statusEl.textContent='Выберите станцию~';return;}
    chrome.runtime.sendMessage({type:'PLAY_RADIO',url:currentRadioUrl},(r)=>{
      if(chrome.runtime.lastError){statusEl.textContent='❌ Ошибка';return;}
      statusEl.textContent='📻 Играет~';
    });
  });
  document.getElementById('radio-pause').addEventListener('click',()=>{chrome.runtime.sendMessage({type:'PAUSE_RADIO'});statusEl.textContent='⏸ Пауза~';});
  document.getElementById('radio-stop').addEventListener('click',()=>{chrome.runtime.sendMessage({type:'STOP_RADIO'});statusEl.textContent='⏹ Стоп';});
}

function initTheme(){
  document.getElementById('theme-toggle').addEventListener('click',()=>{
    isTheme18Plus=!isTheme18Plus;
    document.body.classList.toggle('theme-18plus');
    notify(isTheme18Plus?'Тема 18+ активирована! 🔞':'Обычная тема~ 💖');
  });
}

function initTabs(){
  document.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      const id=tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      tab.classList.add('active');document.getElementById(`tab-${id}`).classList.add('active');
      if(id==='friends')renderFriends();
      if(id==='history')renderHistory();
      if(id==='stats')updateStats();
    });
  });
}

function initSearch(){
  const input=document.getElementById('search-input');
  if(!input)return;
  input.addEventListener('input',(e)=>{searchQuery=e.target.value;renderFriends();});
}

document.addEventListener('DOMContentLoaded',()=>{
  initTabs();initSearch();initRadio();initTheme();renderFriends();
  document.getElementById('refresh-btn').addEventListener('click',()=>{
    document.getElementById('friends-list').innerHTML='<div class="loading">Обновление</div>';
    setTimeout(()=>{chrome.tabs.query({active:true,currentWindow:true},(tabs)=>{if(tabs[0]?.id)chrome.tabs.sendMessage(tabs[0].id,{type:'MANUAL_CHECK'});});setTimeout(renderFriends,1000);},300);
  });
  document.getElementById('export-btn').addEventListener('click',()=>{
    chrome.storage.local.get(['lastFriendsList'],(res)=>{
      const f=res.lastFriendsList||[];
      if(!f.length){notify('Список пуст!');return;}
      const blob=new Blob([JSON.stringify(f,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=`friends-${Date.now()}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);
      notify(`Экспортировано ${f.length} друзей!`);
    });
  });
  document.getElementById('clear-history-btn').addEventListener('click',()=>{
    if(confirm('Очистить историю?\n\nНельзя отменить!')){chrome.storage.local.set({logs:[]},()=>{renderHistory();updateStats();notify('История очищена! ✨');});}
  });
  chrome.runtime.onMessage.addListener((msg)=>{if(msg?.type==='UPDATE_AVAILABLE'){renderFriends();renderHistory();updateStats();}});
  setTimeout(updateStats,500);
});
function renderHistory(){
    const c = document.getElementById('history-list');
    if(!c) return;
    chrome.storage.local.get(['logs'], (res) => {
        const logs = res.logs || [];
        if(!logs.length){
            c.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">История пуста</div><div class="empty-hint">Изменения появятся здесь~</div></div>`;
            return;
        }
        let h = '';
        logs.forEach((log, i) => {
            const ad = log.new?.length || 0;
            const rm = log.removed?.length || 0;
            if(ad === 0 && rm === 0) return;
            
            h += `<div class="log-entry" style="animation-delay:${i*0.05}s">`;
            h += `<div class="log-header"><span class="log-date">📅 ${formatDate(log.date)}</span><div>${ad > 0 ? `<span class="stat-new">+${ad}</span>` : ''}${rm > 0 ? `<span class="stat-removed">−${rm}</span>` : ''}</div></div>`;
            
            // Добавленные друзья (внутренний скролл)
            if(log.new && log.new.length > 0){
                h += `<div class="log-friends">`;
                h += `<div style="color:#4CAF50;font-size:11px;margin-bottom:5px;font-weight:600">✨ Добавлены:</div>`;
                log.new.forEach(f => {
                    const ava = f.avatar || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';
                    h += `<div class="friend-item-mini"><img class="friend-avatar-mini" src="${ava}"><a class="friend-name-mini" href="${f.profileUrl || f.url}" target="_blank">${esc(f.name)}</a><span class="badge-new">+ Новый</span></div>`;
                });
                h += `</div>`;
            }
            
            // Удалённые друзья (внутренний скролл)
            if(log.removed && log.removed.length > 0){
                h += `<div class="log-friends">`;
                h += `<div style="color:#f44336;font-size:11px;margin-bottom:5px;font-weight:600">💔 Удалены:</div>`;
                log.removed.forEach(f => {
                    const ava = f.avatar || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';
                    h += `<div class="friend-item-mini"><img class="friend-avatar-mini" src="${ava}"><a class="friend-name-mini" href="${f.profileUrl || f.url}" target="_blank">${esc(f.name)}</a><span class="badge-removed">− Удалён</span></div>`;
                });
                h += `</div>`;
            }
            
            h += `</div>`;
        });
        c.innerHTML = h;
    });
}