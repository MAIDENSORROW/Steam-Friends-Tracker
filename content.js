// 🎮 Steam Friends Tracker - Fixed Syntax Version

let checkInterval = null;
let hasInitialized = false;
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN = 10000;

function cleanAvatarUrl(url) {
    if (!url) return null;
    return url
        .replace('avatars.akamai.steamstatic.com', 'avatars.steamstatic.com')
        .replace('avatars.cloudflare.steamstatic.com', 'avatars.steamstatic.com')
        .replace('_medium.', '.')
        .replace('_small.', '.')
        .replace('_full.', '.')
        .replace(/\?t=\d+/, '')
        .split('?')[0]
        .split('&')[0];
}

function getFriendsFromPage() {
    const friends = [];
    const seenIds = new Set();
    const containers = document.querySelectorAll('div.friend_block_v2[data-steamid]');
    
    if (containers.length === 0) return [];
    
    containers.forEach(container => {
        const steamId = container.getAttribute('data-steamid') || container.getAttribute('data-miniprofile');
        if (!steamId || seenIds.has(steamId)) return;
        
        let profileUrl = `https://steamcommunity.com/profiles/${steamId}`;
        const overlay = container.querySelector('a.selectable_overlay[href*="/profiles/"], a.selectable_overlay[href*="/id/"]');
        if (overlay?.href) profileUrl = overlay.href.split('?')[0];
        
        let name = 'Unknown';
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
        let node;
        const skipPatterns = [/^онлайн|в сети|offline|online|в игре|playing|last online|добавлен|recently/i, /^\d+$/, /^\•$/, /^[\s\-_]+$/];
        
        while (node = walker.nextNode()) {
            const txt = node.textContent.trim();
            if (!txt || txt.length < 2 || txt.length > 40) continue;
            if (skipPatterns.some(p => p.test(txt))) continue;
            const cleanName = txt.split('|')[0].trim();
            if (cleanName.length >= 2 && cleanName.length <= 40) { name = cleanName; break; }
        }
        if (name === 'Unknown' || !name) {
            name = container.getAttribute('aria-label') || overlay?.getAttribute('title') || steamId;
        }
        
        let avatar = null;
        const img = container.querySelector('img[src*="steamstatic.com"]');
        if (img?.src) avatar = cleanAvatarUrl(img.src);
        const finalAvatar = avatar || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';
        
        seenIds.add(steamId);
        friends.push({ id: steamId, name, avatar: finalAvatar, profileUrl });
    });
    return friends;
}

function checkAndSave() {
    const currentFriends = getFriendsFromPage();
    if (currentFriends.length === 0) return;
    if (hasInitialized) return;
    
    chrome.storage.local.get(['lastFriendsList', 'logs'], (result) => {
        const lastList = result.lastFriendsList || [];
        const logs = result.logs || [];
        
        const lastIds = new Set(lastList.map(f => f.id));
        const currentIds = new Set(currentFriends.map(f => f.id));
        
        const newFriends = currentFriends.filter(f => !lastIds.has(f.id));
        const removedFriends = lastList.filter(f => !currentIds.has(f.id));
        
        const hasChanges = newFriends.length > 0 || removedFriends.length > 0;
        const isFirstLoad = lastList.length === 0;
        
        if (hasChanges || isFirstLoad) {
            const timestamp = Date.now();
            const newLog = { date: timestamp, new: newFriends, removed: removedFriends };
            
            if (!isFirstLoad && hasChanges) {
                logs.unshift(newLog);
                if (logs.length > 50) logs.pop();
                
                const now = Date.now();
                if (now - lastNotificationTime > NOTIFICATION_COOLDOWN) {
                    // 🔧 ИСПРАВЛЕНО: добавлен ключ data:
                    chrome.runtime.sendMessage({
                        type: 'SEND_NOTIFICATION',
                        data: {
                            newFriends: newFriends,
                            removedFriends: removedFriends
                        }
                    }).catch(() => {});
                    lastNotificationTime = now;
                }
            }
            
            hasInitialized = true;
            chrome.storage.local.set({ lastFriendsList: currentFriends, logs: logs });
        }
    });
}

function resetTracker() { hasInitialized = false; checkAndSave(); }

function startTracking() {
    const currentUrl = window.location.href;
    const isMainFriendsPage = currentUrl.includes('/friends') && 
                              !currentUrl.includes('/friends/pending') && 
                              !currentUrl.includes('/friends/outgoing') &&
                              !currentUrl.includes('/friends/blocked');
    if (!isMainFriendsPage) return;
    
    hasInitialized = false;
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(checkAndSave, 2000);
    
    const observer = new MutationObserver((mutations) => {
        const newUrl = window.location.href;
        if (newUrl.includes('/friends') && !newUrl.includes('/friends/pending')) resetTracker();
        const friendsBlocks = document.querySelectorAll('div.friend_block_v2[data-steamid]');
        if (friendsBlocks.length > 0 && !hasInitialized) checkAndSave();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    const originalPushState = history.pushState;
    history.pushState = function(...args) { originalPushState.apply(this, args); resetTracker(); };
    
    setTimeout(checkAndSave, 2000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startTracking);
} else { startTracking(); }

window.addEventListener('load', () => { setTimeout(startTracking, 3000); });

chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'MANUAL_CHECK') { hasInitialized = false; checkAndSave(); }
});