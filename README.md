# 🧠 AccessMate AI – Your Accessibility Companion

> **AI-powered assistive technology for people with visual, hearing, and reading difficulties.**
> 
> Built with Google Gemini AI · Node.js · Vanilla JS

---

## 🌟 Features

| # | Feature | Technology |
|---|---------|-----------|
| 1 | **📷 AI Camera Assistant** – Identify objects, read text from images | Gemini Vision + MediaDevices |
| 2 | **🎤 Speech to Text** – Real-time voice-to-text conversion | Web Speech API |
| 3 | **🔊 Text to Speech** – Natural voice reading with speed/pitch controls | Web Speech Synthesis |
| 4 | **📝 AI Document Summarizer** – Simplify long text in English & Hindi | Gemini AI |
| 5 | **🌐 Language Translator** – Translate between 40+ languages | Gemini AI |
| 6 | **🗣️ Voice Navigation** – Navigate the app hands-free with voice commands | Speech Recognition + Gemini AI |

---

## 🚀 Quick Start (Windows)

### Prerequisites
- **Node.js 18+** → [Download here](https://nodejs.org/)

### One-Click Setup
```
Double-click  setup.bat
```
This will:
1. Check that Node.js is installed
2. Install all dependencies automatically
3. Start the server

### Or Run Manually
```bash
cd accessmate-ai
npm install
npm start
```

Then open **http://localhost:3000** in Chrome.

### Setting Up the API Key (In-App)
1. Open the app in your browser
2. Click **Settings** in the sidebar (or press `Alt+7`)
3. Paste your Gemini API key (get one free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
4. Click **Save Key** → Done!

> No `.env` files to edit. The key is stored securely in your browser's localStorage.

---

## 🏗️ Project Structure

```
accessmate-ai/
├── setup.bat              # One-click install + start (Windows)
├── start.bat              # Quick start for subsequent runs
├── server.js              # Express server + Gemini API proxy
├── package.json           # Dependencies (only 3 packages)
└── public/
    ├── index.html         # Full single-page application
    ├── css/styles.css     # Responsive accessible design system
    └── js/app.js          # All client-side feature logic
```

### API Endpoints (Server)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Server health check |
| POST | `/api/analyze-image` | Camera image analysis |
| POST | `/api/summarize` | Document summarisation (EN/HI) |
| POST | `/api/translate` | Language translation |
| POST | `/api/voice-command` | Voice command interpretation |

> API key is sent from the browser with each request — no server-side config needed.

---

## ♿ Accessibility Features

- **Skip-to-content** link for keyboard users
- **ARIA labels** on all interactive elements
- **Dark mode** toggle (persisted)
- **3 font sizes** — Normal / Large / Extra Large (persisted)
- **Keyboard shortcuts** — Alt+1–7 for pages, Alt+V for voice nav, Escape to close
- **Voice-first** — entire app navigable by voice
- **Screen-reader compatible** with `aria-live` regions
- **Mobile-first** responsive design with bottom navigation
- **Large touch targets** (44×44px minimum)

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + 1` | Dashboard |
| `Alt + 2` | Camera AI |
| `Alt + 3` | Speech to Text |
| `Alt + 4` | Text to Speech |
| `Alt + 5` | Summarizer |
| `Alt + 6` | Translator |
| `Alt + 7` | Settings |
| `Alt + V` | Voice Navigation |
| `Escape` | Close overlays |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3 (Grid, Flexbox, Custom Properties), Vanilla JavaScript |
| Backend | Node.js, Express.js |
| AI | Google Gemini 2.0 Flash (multimodal) |
| Browser APIs | MediaDevices (Camera), Web Speech API (STT/TTS) |
| Design | Material Icons, Inter + Noto Sans Devanagari fonts |

---

## 📱 Browser Support

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ Full |
| Edge 90+ | ✅ Full |
| Firefox 100+ | ⚠️ Limited Speech API |
| Safari 15+ | ⚠️ Limited Speech API |
| Mobile Chrome | ✅ Full |

> **Recommended:** Google Chrome or Microsoft Edge for best experience.

---

## 🏆 Hackathon Differentiators

1. **Real social impact** – helps people with disabilities
2. **Multi-modal AI** – vision + language + speech in one app
3. **Bilingual** – Hindi + English summaries for Indian users
4. **Voice-first UX** – fully navigable by voice
5. **Zero setup** – one-click start, API key via UI
6. **No frameworks** – pure HTML/CSS/JS, runs everywhere
7. **Lightweight** – 3 npm dependencies, <100KB frontend
8. **Free tier** – Gemini 2.0 Flash free (60 RPM)
9. **Privacy** – nothing stored on server
10. **Extensible** – clean architecture for adding features

---

## 📄 License

MIT – Free to use, modify, and distribute.

---

<p align="center">Built with ❤️ for accessibility | <strong>AccessMate AI</strong></p>
