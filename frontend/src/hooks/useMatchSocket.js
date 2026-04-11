import { useEffect, useRef } from 'react';

export function useMatchSocket(onUpdate) {
  const savedCallback = useRef(onUpdate);

  useEffect(() => {
    savedCallback.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    let wsUrl = import.meta.env.VITE_WS_BASE_URL;
    if (!wsUrl) {
      // Determine the base URL for websockets from the current window location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // If dev localhost, target the backend 8000, else use current host
      const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
      wsUrl = `${protocol}//${host}/api/ws/matches`;
    }

    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'match_updated' && data.match) {
          if (savedCallback.current) {
            savedCallback.current(data.match);
          }
        }
      } catch (e) {
        console.error('Failed to parse websocket message', e);
      }
    };

    return () => {
      // If we attempt to synchronously close a CONNECTING socket (readyState 0), 
      // the browser throws a noisy aborted connection warning. 
      // React Strict Mode forces an immediate unmount, so we must defer closure if it's currently connecting.
      if (ws.readyState === 1) {
        ws.close();
      } else if (ws.readyState === 0) {
        ws.onopen = () => ws.close();
      } else {
        ws.close();
      }
    };
  }, []); // Mounts exactly once
}
