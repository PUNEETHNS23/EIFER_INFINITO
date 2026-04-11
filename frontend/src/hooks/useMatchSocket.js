import { useEffect } from 'react';

export function useMatchSocket(onUpdate) {
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
          onUpdate(data.match);
        }
      } catch (e) {
        console.error('Failed to parse websocket message', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [onUpdate]);
}
