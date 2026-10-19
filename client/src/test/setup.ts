import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: () => Promise.resolve(),
}));

// Mock canvas getContext
HTMLCanvasElement.prototype.getContext = () => ({
  clearRect: () => {},
  fillRect: () => {},
  getImageData: () => ({ data: [] }),
  putImageData: () => {},
  createImageData: () => ({ data: [] }),
  setTransform: () => {},
  drawImage: () => {},
  save: () => {},
  fillText: () => {},
  restore: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  closePath: () => {},
  stroke: () => {},
  translate: () => {},
  scale: () => {},
  rotate: () => {},
  arc: () => {},
  fill: () => {},
  measureText: () => ({ width: 0 }),
  transform: () => {},
  rect: () => {},
  clip: () => {},
} as any);

// Ant Design & window mocks for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: () => {},
});

// Mock HTMLMediaElement play/pause
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

// Mock SpeechSynthesis & Utterance
class MockSpeechSynthesisUtterance {
  text = '';
  lang = 'en-US';
  rate = 1;
  pitch = 1;
  volume = 1;
  constructor(text?: string) {
    if (text) this.text = text;
  }
}
(global as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
(window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

Object.defineProperty(window, 'speechSynthesis', {
  writable: true,
  value: {
    speak: () => {},
    cancel: () => {},
    pause: () => {},
    resume: () => {},
    getVoices: () => [],
  },
});

// Mock Audio
class MockAudio {
  src = '';
  play() {
    return Promise.resolve();
  }
  pause() {}
  load() {}
}
(window as any).Audio = MockAudio;

// Default fetch mock returning JSON success with complete Response interface
if (!global.fetch || global.fetch.name === 'fetch') {
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const resObj = {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
      text: async () => JSON.stringify({ success: true, data: [] }),
      headers: new Headers({ 'content-type': 'application/json' }),
      clone() {
        return { ...resObj };
      },
    };
    return resObj as unknown as Response;
  };
}

// Mock ResizeObserver
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as any).ResizeObserver = MockResizeObserver;
(window as any).ResizeObserver = MockResizeObserver;
