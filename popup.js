let currentFriends=[],searchQuery='',favoritesQuery='',statusFilter='',isTheme18Plus=false;
const FRIEND_STATUSES = {
  'none': { label: 'Без статуса', color: '#8b5a7d', icon: '', gradient: 'linear-gradient(135deg, #e0e0e0, #bdbdbd)' },
  'playing_together': { label: '🎮 Играем вместе', color: '#4CAF50', icon: '🎮', gradient: 'linear-gradient(135deg, #4CAF50, #8BC34A)' },
  'favorite': { label: '⭐ Любимый друг', color: '#FFD700', icon: '⭐', gradient: 'linear-gradient(135deg, #FFD700, #FFC107)' },
  'inactive': { label: '💤 Давно не играл', color: '#9E9E9E', icon: '💤', gradient: 'linear-gradient(135deg, #9E9E9E, #757575)' },
  'suspicious': { label: '⚠️ Подозрительный', color: '#f44336', icon: '⚠️', gradient: 'linear-gradient(135deg, #f44336, #e91e63)' }
};
const INACTIVE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней в миллисекундах

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

function filterFriends(friends,query){
  if(!query)return friends;
  const q=query.toLowerCase();
  return friends.filter(f=>f.name.toLowerCase().includes(q)||f.id.includes(q));
}

function renderFriends(){
  const c=document.getElementById('friends-list');
  if(!c)return;
  chrome.storage.local.get(['lastFriendsList','friendStatuses','friendLastOnline'],(res)=>{
    currentFriends=res.lastFriendsList||[];
    const statuses=res.friendStatuses||{};
    const friendLastOnline=res.friendLastOnline||{};
    const now=Date.now();
    
    // Автоматически применяем статус "inactive" для друзей, которых не было больше 7 дней
    Object.keys(friendLastOnline).forEach(id=>{
      const lastSeen=friendLastOnline[id];
      if(now-lastSeen>INACTIVE_THRESHOLD_MS&&!statuses[id]){
        statuses[id]='inactive';
      }
    });
    
    // Применяем фильтр по статусу
    let filtered=searchQuery?filterFriends(currentFriends,searchQuery):currentFriends;
    if(statusFilter&&statusFilter!=='none'){
      filtered=filtered.filter(f=>statuses[f.id]===statusFilter);
    }
    
    if(!filtered.length){
      c.innerHTML=`<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Друзей не найдено</div><div class="empty-hint">${searchQuery||statusFilter?'Попробуйте изменить фильтры':'Зайдите на страницу друзей в Steam~'}</div></div>`;
      return;
    }
    let h='';
    filtered.forEach((f,i)=>{
      const status=statuses[f.id]||'none';
      const statusInfo=FRIEND_STATUSES[status];
      const lastSeen=friendLastOnline[f.id];
      const lastSeenText=lastSeen?`<div style="font-size:9px;color:#c44582;margin-top:3px;">Был в сети: ${formatDate(lastSeen)}</div>`:'';
      h+=`<div class="friend-item" style="animation-delay:${i*0.05}s;border-left:4px solid ${statusInfo.color}"><img class="friend-avatar" src="${f.avatar||'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'}"><div class="friend-info"><a class="friend-name" href="${f.url||f.profileUrl}" target="_blank">${esc(f.name)}</a><div class="friend-steamid">${f.id}</div>${lastSeenText}${status!=='none'?`<div class="friend-status-badge" style="background:${statusInfo.gradient};color:#fff;font-size:10px;font-weight:800;margin-top:6px;padding:4px 10px;border-radius:12px;display:inline-block;box-shadow:0 2px 8px rgba(0,0,0,0.15);">${statusInfo.icon} ${statusInfo.label}</div>`:''}</div><button class="btn-set-status" data-id="${f.id}" style="background:${statusInfo.gradient};border:none;border-radius:10px;padding:6px 10px;cursor:pointer;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.15);transition:all 0.3s;">🏷️</button></div>`;
    });
    c.innerHTML=h;updateStats();
    
    // Обработчики кнопок статуса
    setTimeout(()=>{
      document.querySelectorAll('.btn-set-status').forEach(btn=>{
        btn.addEventListener('click',(e)=>{
          e.stopPropagation();
          const id=btn.dataset.id;
          showStatusMenu(id);
        });
      });
    },100);
  });
}

function showStatusMenu(friendId){
  const menu=document.createElement('div');
  menu.style.cssText='position:fixed;background:linear-gradient(135deg,#fff0f5,#ffe4ec);border-radius:16px;box-shadow:0 8px 32px rgba(255,105,180,0.4);z-index:10000;overflow:hidden;animation:slideDown 0.3s cubic-bezier(0.68,-0.55,0.265,1.55);border:2px solid rgba(255,182,193,0.6);min-width:200px;';
  
  Object.entries(FRIEND_STATUSES).forEach(([key,value])=>{
    const item=document.createElement('div');
    item.innerHTML=`${value.icon} <span style="font-weight:700;">${value.label}</span>`;
    item.style.cssText=`padding:12px 18px;font-size:13px;color:${value.color};cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(255,182,193,0.2);background:${value.gradient};-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 0 ${value.color};`;
    item.onmouseover=()=>{item.style.transform='translateX(8px) scale(1.02)';item.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';};
    item.onmouseout=()=>{item.style.transform='translateX(0) scale(1)';item.style.boxShadow='none';};
    item.onclick=()=>{
      chrome.storage.local.get(['friendStatuses'],(res)=>{
        const statuses=res.friendStatuses||{};
        if(key==='none')delete statuses[friendId];
        else statuses[friendId]=key;
        chrome.storage.local.set({friendStatuses:statuses},()=>{
          renderFriends();
          notify(`Статус установлен: ${value.label} ✨`);
        });
      });
      menu.remove();
    };
    menu.appendChild(item);
  });
  
  document.body.appendChild(menu);
  menu.style.right='20px';
  menu.style.top='100px';
  
  setTimeout(()=>{
    document.addEventListener('click',function close(e){
      if(!menu.contains(e.target)){menu.remove();document.removeEventListener('click',close);}
    },{once:true});
  },100);
}

function renderFavorites(){
  const c=document.getElementById('favorites-list');
  if(!c)return;
  chrome.storage.local.get(['favorites'],(res)=>{
    const favorites=res.favorites||[];
    const filtered=filterFriends(favorites,favoritesQuery);
    if(!filtered.length){
      c.innerHTML=`<div class="empty-state"><div class="empty-icon">⭐</div><div class="empty-text">Избранное пусто</div><div class="empty-hint">${favoritesQuery?'Попробуйте другой запрос':'Добавьте друзей из текущего списка~'}</div></div>`;
      return;
    }
    let h='';
    filtered.forEach((f,i)=>{h+=`<div class="friend-item" style="animation-delay:${i*0.05}s"><img class="friend-avatar" src="${f.avatar||'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'}"><div class="friend-info"><a class="friend-name" href="${f.url||f.profileUrl}" target="_blank">${esc(f.name)}</a><div class="friend-steamid">${f.id}</div></div><button class="btn-remove-fav" data-id="${f.id}" style="background:rgba(245,101,101,0.2);border:1px solid rgba(245,101,101,0.3);color:#f56565;border-radius:8px;padding:4px 8px;cursor:pointer;font-size:10px;font-weight:700;">✕</button></div>`;});
    c.innerHTML=h;
    // Обработчики кнопок удаления
    setTimeout(()=>{
      document.querySelectorAll('.btn-remove-fav').forEach(btn=>{
        btn.addEventListener('click',(e)=>{
          e.stopPropagation();
          const id=btn.dataset.id;
          chrome.storage.local.get(['favorites'],(res)=>{
            const favs=(res.favorites||[]).filter(f=>f.id!==id);
            chrome.storage.local.set({favorites:favs},()=>renderFavorites());
          });
        });
      });
    },100);
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
      if(id==='favorites')renderFavorites();
      if(id==='history')renderHistory();
      if(id==='stats')updateStats();
    });
  });
}

function initSearch(){
  const input=document.getElementById('search-input');
  if(!input)return;
  input.addEventListener('input',(e)=>{searchQuery=e.target.value;renderFriends();});
  
  const favInput=document.getElementById('favorites-search');
  if(favInput){
    favInput.addEventListener('input',(e)=>{favoritesQuery=e.target.value;renderFavorites();});
  }
  
  // Фильтр по статусам
  const statusFilterSelect=document.getElementById('status-filter');
  if(statusFilterSelect){
    statusFilterSelect.addEventListener('change',(e)=>{
      statusFilter=e.target.value;
      renderFriends();
    });
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  initTabs();initSearch();initTheme();renderFriends();
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
  // Кнопка добавления в избранное
  document.getElementById('add-favorites-btn').addEventListener('click',()=>{
    chrome.storage.local.get(['lastFriendsList','favorites'],(res)=>{
      const current=res.lastFriendsList||[];
      const existing=res.favorites||[];
      const existingIds=new Set(existing.map(f=>f.id));
      const toAdd=current.filter(f=>!existingIds.has(f.id));
      if(toAdd.length===0){notify('Все друзья уже в избранном! ⭐');return;}
      const updated=[...existing,...toAdd];
      chrome.storage.local.set({favorites:updated},()=>{
        renderFavorites();
        notify(`Добавлено ${toAdd.length} друзей в избранное! ⭐`);
      });
    });
  });
  // Кнопка очистки избранного
  document.getElementById('clear-favorites-btn').addEventListener('click',()=>{
    if(confirm('Очистить избранное?\n\nНельзя отменить!')){
      chrome.storage.local.set({favorites:[]},()=>{renderFavorites();notify('Избранное очищено! ✨');});
    }
  });
  document.getElementById('clear-history-btn').addEventListener('click',()=>{
    if(confirm('Очистить историю?\n\nНельзя отменить!')){chrome.storage.local.set({logs:[]},()=>{renderHistory();updateStats();notify('История очищена! ✨');});}
  });
  chrome.runtime.onMessage.addListener((msg)=>{if(msg?.type==='UPDATE_AVAILABLE'){renderFriends();renderFavorites();renderHistory();updateStats();}});
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