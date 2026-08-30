import { useEffect, useRef, useCallback } from 'react';

/**
 * WebSocket hook for real-time updates
 * @param {string} token - JWT token
 * @param {function} onMessage - Callback for incoming messages
 * @param {string} backendUrl - Backend URL
 */
export const useWebSocket = (token, onMessage, backendUrl) => {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (!token || !backendUrl) return;
    
    // Convert http(s) to ws(s)
    const wsUrl = backendUrl.replace(/^http/, 'ws') + `/ws/${token}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('[WS] Connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) onMessage(data);
        } catch {
          // Non-JSON message (e.g., pong)
        }
      };
      
      ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting in 5s...');
        reconnectTimer.current = setTimeout(connect, 5000);
      };
      
      ws.onerror = () => {
        ws.close();
      };
      
      wsRef.current = ws;
    } catch {
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, [token, backendUrl, onMessage]);

  useEffect(() => {
    connect();
    
    // Ping every 30s to keep alive
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 30000);
    
    return () => {
      clearInterval(pingInterval);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return wsRef;
};
