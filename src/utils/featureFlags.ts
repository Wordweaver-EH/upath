// src/utils/featureFlags.ts
export const isZustandEnabled = (): boolean => {
  return process.env.REACT_APP_USE_ZUSTAND === 'true';
};