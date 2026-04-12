import { useEffect, useRef } from 'react';

export function useMatchSocket(onUpdate) {
  const savedCallback = useRef(onUpdate);

  const resolveWsUrl = () => {
    if (import.meta.env.VITE_WS_BASE_URL) {
      return import.meta.env.VITE_WS_BASE_URL;
    }

    const apiBase = import.meta.env.VITE_API_BASE_URL;
    if (apiBase) {
      try {
        // Expected API base is like http://host:port/api
        const parsed = new URL(apiBase);
        const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${wsProtocol}//${parsed.host}/api/ws/matches`;
      } catch {
        // Ignore invalid URL and fallback below.
      }
    }

    // Final fallback from browser location.
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const localHosts = ['localhost', '127.0.0.1'];
    const host = localHosts.includes(window.location.hostname)
      ? `${window.location.hostname}:8000`
      : window.location.host;
    return `${wsProtocol}//${host}/api/ws/matches`;
  };

  useEffect(() => {
    savedCallback.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const wsUrl = resolveWsUrl();

    let ws = null;
    let reconnectTimer = null;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'match_updated' && data.match && savedCallback.current) {
            savedCallback.current(data.match);
          }
        } catch (e) {
          console.error('Failed to parse websocket message', e);
        }
      };

      ws.onclose = () => {
        if (isDisposed) return;
        reconnectTimer = setTimeout(connect, 1200);
      };

      ws.onerror = () => {
        // Ensure close handler runs and reconnects.
        ws?.close();
      };
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);

      if (!ws) return;
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
