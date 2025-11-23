import { useEffect, useRef, useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";

export function useCollaborativeCursors(boardId, sendWebSocketMessage) {
  const reactFlowInstance = useReactFlow();
  const { getViewport } = reactFlowInstance;
  const [otherUsersCursors, setOtherUsersCursors] = useState(new Map());
  const cursorUpdateTimerRef = useRef(null);
  const userIdRef = useRef(
    `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const lastSentPositionRef = useRef(null);

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

  // Track and send cursor position
  useEffect(() => {
    if (!sendWebSocketMessage || !boardId) return;

    const handleMouseMove = (event) => {
      if (cursorUpdateTimerRef.current) {
        clearTimeout(cursorUpdateTimerRef.current);
      }

      cursorUpdateTimerRef.current = setTimeout(() => {
        try {
          // Get the React Flow pane element to calculate relative coordinates
          const reactFlowPane = document.querySelector(".react-flow__pane");
          if (!reactFlowPane) {
            return; // React Flow not ready yet
          }

          const rect = reactFlowPane.getBoundingClientRect();
          const viewport = getViewport();

          // Calculate relative position within the React Flow pane
          const relativeX = event.clientX - rect.left;
          const relativeY = event.clientY - rect.top;

          // Convert to flow coordinates using viewport transform
          // Flow coordinates = (screen coordinates / zoom) - pan offset
          const flowX = relativeX / viewport.zoom - viewport.x;
          const flowY = relativeY / viewport.zoom - viewport.y;

          const flowPosition = { x: flowX, y: flowY };

          const lastPos = lastSentPositionRef.current;
          if (
            !lastPos ||
            Math.abs(lastPos.x - flowPosition.x) > 10 ||
            Math.abs(lastPos.y - flowPosition.y) > 10
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
      }, 100);
    };

    const handleMouseLeave = () => {
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
    };

    // Track mouse movement on the entire window (React Flow will handle coordinate conversion)
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      if (cursorUpdateTimerRef.current) {
        clearTimeout(cursorUpdateTimerRef.current);
      }
    };
  }, [sendWebSocketMessage, boardId, getViewport]);

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
