import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

/**
 * Hook that monitors network connectivity.
 * Returns { isConnected, isInternetReachable, check }.
 */
export function useNetwork() {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
      setIsInternetReachable(state.isInternetReachable ?? true);
    });
    return () => unsubscribe();
  }, []);

  /** Manual re-check */
  const check = async () => {
    const state = await NetInfo.fetch();
    setIsConnected(state.isConnected ?? true);
    setIsInternetReachable(state.isInternetReachable ?? true);
    return state.isConnected ?? true;
  };

  return { isConnected, isInternetReachable, check };
}
