import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Custom React hook for WebSocket connections.
 *
 * Works with FastAPI's built-in WebSocket support.
 *
 * Usage:
 *   const { sendMessage, isConnected } = useWebSocket('board-001', {
 *     onNodeMoved: (data) => console.log('Node moved:', data),
 *     onNodeCreated: (data) => console.log('Node created:', data),
 *   });
 */
export function useWebSocket(boardId, callbacks = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const isConnectingRef = useRef(false);

  // Store callbacks in refs so they don't trigger reconnections
  const callbacksRef = useRef(callbacks);

  // Update callbacks ref when they change (without triggering reconnection)
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // Function to connect to WebSocket
  const connect = useCallback(() => {
    if (!boardId) return;

    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log("Connection attempt already in progress, skipping...");
      return;
    }

    // If already connected, don't reconnect
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected, skipping...");
      return;
    }

    isConnectingRef.current = true;

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Create WebSocket connection
    // ws://localhost:8000/api/ws/board-001
    const wsUrl = `ws://localhost:8000/api/ws/${boardId}`;
    console.log(`Attempting to connect to ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected to board:", boardId);
      setIsConnected(true);
      reconnectAttempts.current = 0;
      isConnectingRef.current = false;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type } = message;

        // Get current callbacks from ref
        const {
          onNodeMoved,
          onNodeCreated,
          onNodeUpdated,
          onNodeDeleted,
          onEdgeCreated,
          onEdgeDeleted,
          onUserJoined,
          onUserLeft,
          onCursorMoved,
          onError,
        } = callbacksRef.current;

        // Handle different message types
        switch (type) {
          case "node_moved":
            onNodeMoved?.(message);
            break;

          case "node_created":
            onNodeCreated?.(message);
            break;

          case "node_updated":
            onNodeUpdated?.(message);
            break;

          case "node_deleted":
            onNodeDeleted?.(message);
            break;

          case "edge_created":
            onEdgeCreated?.(message);
            break;

          case "edge_deleted":
            onEdgeDeleted?.(message);
            break;

          case "user_joined":
            onUserJoined?.(message);
            break;

          case "user_left":
            onUserLeft?.(message);
            break;

          case "cursor_moved":
            onCursorMoved?.(message);
            break;

          case "error":
            onError?.(message);
            break;

          default:
            console.warn("Unknown message type:", type);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
      isConnectingRef.current = false;
      const { onError } = callbacksRef.current;
      onError?.({ message: "WebSocket connection error" });
    };

    ws.onclose = (event) => {
      console.log("WebSocket disconnected", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      setIsConnected(false);
      isConnectingRef.current = false;

      // Don't reconnect if it was a clean close (e.g., user navigated away)
      // or if we're switching boards (boardId changed)
      if (event.code === 1000 || event.code === 1001) {
        console.log("Clean close, not reconnecting");
        return;
      }

      // Attempt to reconnect only if we still have the same boardId
      if (reconnectAttempts.current < maxReconnectAttempts && boardId) {
        reconnectAttempts.current += 1;
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttempts.current),
          10000
        );
        console.log(
          `Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          // Only reconnect if boardId hasn't changed
          if (boardId) {
            connect();
          }
        }, delay);
      } else {
        console.error("Max reconnection attempts reached or boardId changed");
      }
    };

    wsRef.current = ws;
  }, [boardId]); // Only depend on boardId, not callbacks

  // Function to send a message
  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not connected. Message not sent:", message);
    }
  }, []);

  // Connect when boardId changes
  useEffect(() => {
    // Reset reconnection attempts when boardId changes
    reconnectAttempts.current = 0;
    connect();

    // Cleanup on unmount or boardId change
    return () => {
      isConnectingRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        // Close with code 1000 (normal closure) to prevent reconnection
        wsRef.current.close(1000, "Board changed or component unmounted");
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected,
    sendMessage,
  };
}
