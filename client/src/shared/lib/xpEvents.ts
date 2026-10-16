export interface XpEarnedDetail {
  xpReward: number;
  totalXp?: number;
  streak?: number;
  source?: string;
}

export const xpEventBus = {
  emit(detail: XpEarnedDetail) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fluentiq_xp_earned', { detail }));
    }
  },
  subscribe(callback: (detail: XpEarnedDetail) => void) {
    if (typeof window === 'undefined') return () => {};
    const handler = (e: Event) => {
      const custom = e as CustomEvent<XpEarnedDetail>;
      if (custom.detail) callback(custom.detail);
    };
    window.addEventListener('fluentiq_xp_earned', handler);
    return () => window.removeEventListener('fluentiq_xp_earned', handler);
  }
};
