# Story 48.5: Investigation Spike — Voice Navigation

Status: done

## Story

As a team exploring accessibility options,
I want a technical assessment of browser Speech API for dashboard navigation,
so that we can decide whether to add voice control.

## Tasks / Subtasks

- [x] Task 1: Research and produce technical assessment document
  - [x] 1.1: Document browser support matrix
  - [x] 1.2: Assess SpeechRecognition API
  - [x] 1.3: Design integration with NLU parser (47.3)
  - [x] 1.4: Provide effort estimate and recommendation

## Technical Assessment: Voice Navigation

### Browser Support Matrix

| Browser | SpeechRecognition | SpeechSynthesis | Notes |
|---------|-------------------|-----------------|-------|
| Chrome 33+ | Yes | Yes | Best support, uses Google servers |
| Edge 79+ | Yes | Yes | Chromium-based, same as Chrome |
| Safari 14.1+ | Yes (prefixed) | Yes | `webkitSpeechRecognition` |
| Firefox | No | Yes | No SpeechRecognition support |
| Mobile Chrome | Yes | Yes | Works well on Android |
| Mobile Safari | Partial | Yes | Requires user gesture to start |

### API Capabilities

- **Continuous mode**: Listen indefinitely (Chrome only)
- **Interim results**: Show partial transcription while speaking
- **Language support**: 50+ languages via `lang` property
- **Confidence score**: 0-1 per result alternative
- **Limitations**: Requires HTTPS, sends audio to cloud (privacy concern), no Firefox

### Integration Approach

1. **`useVoiceCommand()` hook** — wraps SpeechRecognition with start/stop/listening state
2. **Feed transcript to `parseCommand()` (Story 47.3)** — existing NLU parser handles intent extraction
3. **Activation**: Push-to-talk button or "Hey AO" wake word (wake word needs continuous listening)
4. **Feedback**: Show transcript + parsed intent before executing

### Effort Estimate

- Hook + NLU integration: 3-5 days
- Wake word detection: +2-3 days (optional)
- Browser fallback (no voice): 1 day

### Recommendation: **CONDITIONAL GO — Chrome/Edge only**

Viable for Chrome/Edge users (~75% market share). Firefox users get keyboard-only experience. Integration with existing NLU parser (47.3) is straightforward — voice becomes an input method, not a separate parsing system.

**Blocker**: Privacy-sensitive teams may reject cloud-based speech recognition.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### File List

- _bmad-output/implementation-artifacts/48-5-spike-voice-navigation.md
