🎮 Steam Friends Tracker
Расширение для Chrome • Версия 10.0 • 💖 Отслеживай друзей с любовью
📋 Описание
Steam Friends Tracker — это удобное расширение для браузера, которое помогает отслеживать изменения в списке друзей Steam. Узнавайте, кто добавил вас в друзья, кто удалил, и ведите статистику своих социальных связей в Steam!
✨ Дополнительные фишки: красивый видео-фон, встроенное интернет-радио и тема 18+ для настроения~

## 🚀 Installation

### Google Chrome / Edge / Yandex
1. Clone or download this repository.
2. Open `chrome://extensions/` in your browser.
3. Enable **Developer mode** (toggle in the top right).
4. Click **Load unpacked** and select the folder containing the extension files.

### Mozilla Firefox
1. Clone or download this repository.
2. Open `about:debugging#/runtime/this-firefox` in your browser.
3. Click **Load Temporary Add-on**.
4. Select the `manifest.json` file from the extension folder.
   > **Note:** For Firefox, ensure `manifest.json` uses `manifest_version: 2` and `background.scripts` instead of `service_worker` for best compatibility.

## 🛠 Usage

1. Navigate to your Steam Friends page: `https://steamcommunity.com/friends/`.
2. The extension will automatically start tracking.
3. Click the extension icon in your toolbar to view the history log.
4. Use the **Refresh** button to update the log manually.
5. Use the **Clear** button to reset all stored history.

## 🔒 Permissions

| Permission | Reason |
| :--- | :--- |
| `storage` | To save friends list history locally. |
| `notifications` | To send desktop alerts about changes. |
| `*://steamcommunity.com/*` | To read friends list data on Steam pages. |
| `*://*.steamstatic.com/*` | To load avatar images correctly. |

## ⚠️ Disclaimer

This project is **not affiliated with Valve Corporation or Steam**. Steam and the Steam logo are trademarks and/or registered trademarks of Valve Corporation in the U.S. and/or other countries.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

**Created with ✨ by [MAIDEN]**
