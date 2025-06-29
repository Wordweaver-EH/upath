// Feature flag hook to determine if Zustand should be used
export const useZustand = () => {
  return process.env.REACT_APP_USE_ZUSTAND === 'true'
}