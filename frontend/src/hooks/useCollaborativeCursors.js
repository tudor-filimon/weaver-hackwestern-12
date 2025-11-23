import { useEffect, useRef, useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";

export function useCollaborativeCursors(boardId, sendWebSocketMessage) {
  const reactFlowInstance = useReactFlow();
  const { screenToFlowPosition, getViewport } = reactFlowInstance;
  const [otherUsersCursors, setOtherUsersCursors] = useState(new Map());
  const animationFrameRef = useRef(null);
  const userIdRef = useRef(
    `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const lastSentPositionRef = useRef(null);
  const pendingPositionRef = useRef(null);

  const userColors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E2",
  ];
  const userColorMapRef = useRef(new Map());

  const getColorForUser = useCallback((userId) => {
    if (!userColorMapRef.current.has(userId)) {
      const colorIndex = userColorMapRef.current.size % userColors.length;
      userColorMapRef.current.set(userId, userColors[colorIndex]);
    }
    return userColorMapRef.current.get(userId);
  }, []);

  // Track and send cursor position - optimized for minimal delay
  useEffect(() => {
    if (!sendWebSocketMessage || !boardId) return;

    const handleMouseMove = (event) => {
      // Store the latest position
      pendingPositionRef.current = { clientX: event.clientX, clientY: event.clientY };

      // Use requestAnimationFrame for smooth, low-latency updates
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(() => {
          animationFrameRef.current = null;
          
          if (!pendingPositionRef.current) return;

          try {
            // Get the React Flow pane to calculate relative coordinates
            const paneElement = document.querySelector('.react-flow__pane');
            if (!paneElement) return;
            
            const paneRect = paneElement.getBoundingClientRect();
            
            // Convert window coordinates to pane-relative coordinates
            const paneRelativeX = pendingPositionRef.current.clientX - paneRect.left;
            const paneRelativeY = pendingPositionRef.current.clientY - paneRect.top;
            
            // Use React Flow's built-in coordinate conversion with pane-relative coordinates
            const flowPosition = screenToFlowPosition({
              x: paneRelativeX,
              y: paneRelativeY,
            });

            const lastPos = lastSentPositionRef.current;
            // Only send if cursor moved more than 5px
            if (
              !lastPos ||
              Math.abs(lastPos.x - flowPosition.x) > 5 ||
              Math.abs(lastPos.y - flowPosition.y) > 5
            ) {
              sendWebSocketMessage({
                type: "cursor_moved",
                cursor_data: {
                  user_id: userIdRef.current,
                  x: flowPosition.x,
                  y: flowPosition.y,
                  timestamp: Date.now(),
                },
              });
              lastSentPositionRef.current = flowPosition;
            }
          } catch (error) {
            console.error("Error sending cursor position:", error);
          }
        });
      }
    };

    const handleMouseLeave = () => {
      // Cancel pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Send null position when mouse leaves the canvas
      sendWebSocketMessage({
        type: "cursor_moved",
        cursor_data: {
          user_id: userIdRef.current,
          x: null,
          y: null,
          timestamp: Date.now(),
        },
      });
      lastSentPositionRef.current = null;
      pendingPositionRef.current = null;
    };

    // Track mouse movement on the entire window
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [sendWebSocketMessage, boardId, screenToFlowPosition]);

  // Handle incoming cursor updates
  const handleCursorMoved = useCallback((message) => {
    const cursorData = message.cursor_data;
    if (!cursorData || !cursorData.user_id) return;
    if (cursorData.user_id === userIdRef.current) return;

    setOtherUsersCursors((prev) => {
      const newMap = new Map(prev);
      if (cursorData.x === null || cursorData.y === null) {
        newMap.delete(cursorData.user_id);
      } else {
        newMap.set(cursorData.user_id, {
          x: cursorData.x,
          y: cursorData.y,
          timestamp: cursorData.timestamp || Date.now(),
        });
      }
      return newMap;
    });
  }, []);

  // Cleanup stale cursors
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setOtherUsersCursors((prev) => {
        const newMap = new Map();
        for (const [userId, cursor] of prev.entries()) {
          if (now - cursor.timestamp < 3000) {
            newMap.set(userId, cursor);
          }
        }
        return newMap;
      });
    }, 1000);
    return () => clearInterval(cleanupInterval);
  }, []);

  return {
    otherUsersCursors,
    getColorForUser,
    handleCursorMoved,
  };
}
