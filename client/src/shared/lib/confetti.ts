import confetti from 'canvas-confetti';

export function fireCelebration() {
  try {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899']
    });
  } catch (e) {
    // Graceful fallback if canvas is restricted
  }
}
