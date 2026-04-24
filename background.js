// 🔥 Steam Friends Tracker Pro v3.0 - Steam Web API Integration
// Background script with Auto-Monitoring via Steam API

let monitoringInterval = null;
const API_KEY_STORAGE_KEY = 'steamWebApiKey';
const USER_STEAM_ID_KEY = 'userSteamId';
const MONITORING_INTERVAL_MS = 5000; // 5 секунд

// Кэш статусов друзей
let friendStatusCache = {};
const STATUS_CACHE_TTL = 30000;

// Проверка наличия API ключа
async function hasApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get([API_KEY_STORAGE_KEY], (result) => {
      resolve(!!result[API_KEY_STORAGE_KEY]);
    });
  });
}

// Получение API ключа
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get([API_KEY_STORAGE_KEY], (result) => {
      resolve(result[API_KEY_STORAGE_KEY] || null);
    });
  });
}

// Получение Steam ID пользователя
async function getUserSteamId() {
  return new Promise((resolve) => {
    chrome.storage.local.get([USER_STEAM_ID_KEY], (result) => {
      resolve(result[USER_STEAM_ID_KEY] || null);
    });
  });
}

// Получение списка друзей через Steam Web API
async function fetchFriendsFromAPI() {
  const apiKey = await getApiKey();
  const steamId = await getUserSteamId();
  
  if (!apiKey || !steamId) {
    console.log('[API] Нет API ключа или Steam ID');
    return null;
  }
  
  try {
    // Получаем список друзей
    const friendsUrl = `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${apiKey}&steamid=${steamId}&relationship=friend`;
    const friendsResponse = await fetch(friendsUrl);
    
    if (!friendsResponse.ok) {
      throw new Error(`API error: ${friendsResponse.status}`);
    }
    
    const friendsData = await friendsResponse.json();
    
    if (!friendsData.friendslist || !friendsData.friendslist.friends) {
      return [];
    }
    
    const friendIds = friendsData.friendslist.friends.map(f => f.steamid);
    
    // Получаем информацию о друзьях (профили)
    const summariesUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${friendIds.join(',')}`;
    const summariesResponse = await fetch(summariesUrl);
    
    if (!summariesResponse.ok) {
      throw new Error(`API error: ${summariesResponse.status}`);
    }
    
    const summariesData = await summariesResponse.json();
    
    if (!summariesData.response || !summariesData.response.players) {
      return [];
    }
    
    return summariesData.response.players.map(player => ({
      id: player.steamid,
      name: player.personaname,
      avatar: player.avatarfull || player.avatarmedium || player.avatar,
      profileUrl: player.profileurl,
      personastate: player.personastate,
      lastlogoff: player.lastlogoff,
      gameid: player.gameid,
      gameextrainfo: player.gameextrainfo
    }));
    
  } catch (error) {
    console.error('[API] Ошибка получения данных:', error);
    return null;
  }
}

// Определение статуса друга на основе personastate
function getPersonastateStatus(personastate, lastlogoff) {
  if (personastate === 1) return 'online';
  if (personastate >= 2 && personastate <= 4) return 'ingame';
  
  // Если офлайн, проверяем когда был последний раз
  if (lastlogoff) {
    const now = Math.floor(Date.now() / 1000);
    const secondsSinceLastSeen = now - lastlogoff;
    const daysSinceLastSeen = secondsSinceLastSeen / (60 * 60 * 24);
    
    if (daysSinceLastSeen > 7) {
      return 'inactive';
    }
  }
  
  return 'offline';
}

// Обновление списка друзей через API
async function updateFriendsFromAPI() {
  const friends = await fetchFriendsFromAPI();
  
  if (!friends) {
    console.log('[API] Не удалось получить данные');
    return;
  }
  
  console.log(`[API] Получено ${friends.length} друзей`);
  
  chrome.storage.local.get(['lastFriendsList', 'logs', 'friendLastOnline'], (result) => {
    const lastList = result.lastFriendsList || [];
    const logs = result.logs || [];
    const friendLastOnline = result.friendLastOnline || {};
    
    // Если это первый запуск через API
    if (lastList.length === 0) {
      console.log('[API] Первый запуск, сохраняем список');
      const now = Date.now();
      friends.forEach(f => {
        if (f.lastlogoff) {
          friendLastOnline[f.id] = f.lastlogoff * 1000;
        } else if (f.personastate === 1) {
          friendLastOnline[f.id] = now;
        }
      });
      
      chrome.storage.local.set({ 
        lastFriendsList: friends, 
        logs: [],
        friendLastOnline: friendLastOnline
      }, () => {
        chrome.runtime.sendMessage({ type: 'UPDATE_AVAILABLE' }).catch(() => {});
      });
      return;
    }
    
    const lastIds = new Set(lastList.map(f => f.id));
    const currentIds = new Set(friends.map(f => f.id));
    
    const newFriends = friends.filter(f => !lastIds.has(f.id));
    const removedFriends = lastList.filter(f => !currentIds.has(f.id));
    
    // Обновляем время последнего появления
    const now = Date.now();
    friends.forEach(f => {
      if (f.personastate === 1 || f.personastate >= 2) {
        friendLastOnline[f.id] = now;
      } else if (f.lastlogoff) {
        friendLastOnline[f.id] = f.lastlogoff * 1000;
      }
    });
    
    if (newFriends.length > 0 || removedFriends.length > 0) {
      const timestamp = Date.now();
      const newLog = { date: timestamp, new: newFriends, removed: removedFriends };
      const updatedLogs = [newLog, ...logs].slice(0, 50);
      
      console.log(`[API] Изменения: ${newFriends.length} новых, ${removedFriends.length} удалённых`);
      
      chrome.storage.local.set({ 
        lastFriendsList: friends, 
        logs: updatedLogs,
        friendLastOnline: friendLastOnline
      }, () => {
        chrome.runtime.sendMessage({ type: 'UPDATE_AVAILABLE' }).catch(() => {});
        
        // Отправка уведомления
        if (newFriends.length > 0 || removedFriends.length > 0) {
          sendNotification(newFriends, removedFriends);
        }
      });
    } else {
      console.log('[API] Изменений нет, обновляем время последнего появления');
      chrome.storage.local.set({ friendLastOnline: friendLastOnline });
    }
  });
}

// Запуск авто-мониторинга через API
function startAutoMonitoring() {
  if (monitoringInterval) clearInterval(monitoringInterval);
  
  monitoringInterval = setInterval(async () => {
    const hasKey = await hasApiKey();
    if (hasKey) {
      await updateFriendsFromAPI();
    }
  }, MONITORING_INTERVAL_MS);
  
  console.log('[Background] Авто-мониторинг через API запущен');
}

// Остановка мониторинга
function stopAutoMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('[Background] Авто-мониторинг остановлен');
  }
}

// Инициализация при запуске
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Расширение установлено/обновлено');
});

// Запускаем мониторинг при старте
startAutoMonitoring();

// Обработчик сообщений
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_API_KEY') {
    hasApiKey().then(has => sendResponse({ has }));
    return true;
  }
  
  if (message.type === 'SET_API_KEY') {
    chrome.storage.local.set({ 
      [API_KEY_STORAGE_KEY]: message.apiKey,
      [USER_STEAM_ID_KEY]: message.steamId
    }, () => {
      console.log('[Background] API ключ и Steam ID сохранены');
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'GET_API_INFO') {
    Promise.all([getApiKey(), getUserSteamId()]).then(([apiKey, steamId]) => {
      sendResponse({ apiKey: apiKey ? '***' + apiKey.slice(-4) : null, steamId });
    });
    return true;
  }
  
  // Обработчик для сохранения только Steam ID из OpenID
  if (message.type === 'SET_STEAM_ID') {
    chrome.storage.local.set({ [USER_STEAM_ID_KEY]: message.steamId }, () => {
      console.log('[Background] Steam ID сохранён');
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'CLEAR_API_KEY') {
    chrome.storage.local.remove([API_KEY_STORAGE_KEY, USER_STEAM_ID_KEY], () => {
      console.log('[Background] API ключ удалён');
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'FETCH_NOW') {
    updateFriendsFromAPI().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'RESTART_MONITORING') {
    startAutoMonitoring();
    sendResponse({ success: true });
    return true;
  }
  
  return true;
});

// Уведомления
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN = 10000;

function sendNotification(newFriends, removedFriends) {
  const now = Date.now();
  if (now - lastNotificationTime < NOTIFICATION_COOLDOWN) return;
  
  const added = newFriends?.length || 0;
  const removed = removedFriends?.length || 0;
  if (added === 0 && removed === 0) return;
  
  let title = '🎮 Friends Tracker Pro';
  let msg = '';
  
  if (added > 0 && removed > 0) {
    msg = `+${added} новых, −${removed} удалено`;
  } else if (added > 0) {
    const names = newFriends.slice(0, 3).map(f => f.name).join(', ');
    msg = `+${added} новых: ${names}${added > 3 ? ' и др.' : ''}`;
  } else {
    const names = removedFriends.slice(0, 3).map(f => f.name).join(', ');
    msg = `−${removed} удалено: ${names}${removed > 3 ? ' и др.' : ''}`;
  }
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: title,
    message: msg,
    priority: 2,
    requireInteraction: false
  });
  
  lastNotificationTime = now;
}
