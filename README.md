# Project ECHO - Agency Mainframe

A gamified web application for Charlotte Mason dictation and recitation practice, designed for homeschool students.

## 🎯 What is this?

Project ECHO helps students practice **dictation** (spelling/writing) and **recitation** (memorization) through an engaging spy/agent narrative. The app features:

- **The Mainframe** 🖥️ - A calm, encouraging AI that guides training
- **Dr. Glitch** ⚡ - A chaotic villain who wants to corrupt language

## ✨ Features

### Protocol A: The Voice Lock (Recitation)
A 4-step memorization process:
1. **Signal Sync** - Read along with the audio (3 reps)
2. **Blind Transmission** - Repeat without seeing the text (3 reps)  
3. **Sector Clearance** - Solo recitation of each stanza
4. **Master Broadcast** - Full recitation from memory

### Protocol B: The Logic Bomb (Dictation)
Charlotte Mason-style prepared dictation:
1. **Study** - Memorize the sentence, identify "Trap Words"
2. **Hide** - Text is hidden
3. **Input** - Listen and type what you hear
4. **Check** - Compare with corrections shown

## 🎨 Design

- Dark spy terminal aesthetic
- Large, accessible buttons (48px minimum touch targets)
- Left-hand optimized controls
- Patient pacing with "I'm Ready" confirmations
- Never blames speech difficulties - uses "Signal static" for transcription issues

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Start the development server
```bash
npm run dev
```

### 3. Configure API Keys (Optional but Recommended)

For the best experience, configure:

- **AssemblyAI** - For speech recognition during recitation
  - Get your key at: https://www.assemblyai.com/
  
- **ElevenLabs** - For natural text-to-speech
  - Get your key at: https://elevenlabs.io/

Without API keys, the app uses browser-based speech synthesis (works but less natural).

### 4. Upload Your Content

1. Click "Upload New Intel"
2. Paste your poem/scripture for recitation (Protocol A)
3. Paste your dictation sentences (Protocol B)
4. Save and start training!

## 📁 Project Structure

```
src/
├── components/
│   ├── HomeScreen.tsx       # Main dashboard
│   ├── UploadIntel.tsx      # Paste poems/dictation
│   ├── Settings.tsx         # API key configuration
│   ├── ProtocolA/           # Recitation (Voice Lock)
│   ├── ProtocolB/           # Dictation (Logic Bomb)
│   └── ui/                  # Reusable UI components
├── services/
│   ├── speechToText.ts      # AssemblyAI integration
│   ├── textToSpeech.ts      # ElevenLabs integration
│   ├── textComparison.ts    # Spelling comparison
│   └── storage.ts           # IndexedDB persistence
├── context/
│   └── AppContext.tsx       # Global state management
└── types/
    └── index.ts             # TypeScript definitions
```

## 🛠️ Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Dexie.js** for IndexedDB storage
- **AssemblyAI** for speech-to-text
- **ElevenLabs** for text-to-speech

## 🔒 Privacy

- API keys are stored locally in your browser only
- No data is sent to any server except the official API endpoints
- All progress is saved locally

## 📝 License

MIT - Feel free to use and modify for your homeschool needs!

---

*Built with love for Charlotte Mason homeschoolers* 🏠📚

