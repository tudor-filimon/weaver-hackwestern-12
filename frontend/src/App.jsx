import { useState, useCallback, useEffect, useRef } from "react";

import {
  ReactFlow,
  Background,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { boardAPI, nodeAPI, edgeAPI } from "./utils/api"; // ********** NEW CODE HERE **********

import ChatNode from "./components/ChatNode.jsx";
import Layout from "./components/Layout.jsx";
import Hotbar from "./components/Hotbar.jsx";
import SearchModal from "./components/SearchModal.jsx";

// NEW: Import the comprehensive WebSocket hooks
import { useWebSocket } from "./hooks/useWebSocket.js";
import { useCollaborativeCursors } from "./hooks/useCollaborativeCursors.js";

const nodeTypes = { chat: ChatNode };

function Flow() {
  // Define handlers first so we can pass them to initial state if needed,
  // but typically we inject them via effects or map over state.

  const { fitView, getNode, getViewport, setCenter, screenToFlowPosition, flowToScreenPosition } =
    useReactFlow();
  const [edges, setEdges] = useState([]);
  // Load color mode from localStorage, default to "dark" if not found
  const [colorMode, setColorMode] = useState(() => {
    const savedColorMode = localStorage.getItem("colorMode");
    return savedColorMode || "dark";
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // ********** NEW CODE HERE **********
  const [boardId, setBoardId] = useState("board-001"); // Default board ID. First one it opens when website opens
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFading, setIsLoadingFading] = useState(false);
  // Load sidebar collapse state from localStorage, default to false if not found
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const savedSidebarState = localStorage.getItem("isSidebarCollapsed");
    return savedSidebarState === "true";
  });
  const [currentBoardName, setCurrentBoardName] = useState(null);

  // NEW: Track number of other users online
  const [otherUsersCount, setOtherUsersCount] = useState(0);

  // Create a ref to store sendMessage (will be set after useWebSocket)
  const sendMessageRef = useRef(null);

  // Get cursor state and handlers from the hook (MUST BE BEFORE useWebSocket)
  // Pass a wrapper function that uses the ref - use useCallback to make it stable
  const sendCursorMessage = useCallback((message) => {
    // Always check the ref to get the latest sendMessage function
    if (sendMessageRef.current) {
      sendMessageRef.current(message);
    }
  }, []); // Empty deps - function always checks the ref

  const { otherUsersCursors, getColorForUser, handleCursorMoved } = useCollaborativeCursors(
    boardId, 
    sendCursorMessage
  );

  // ********** WEBSOCKET INTEGRATION - ADD THIS **********
  const { sendMessage, isConnected } = useWebSocket(boardId, {
    // Handle incoming node movements from other users
    onNodeMoved: useCallback((message) => {
      console.log("Node moved by another user:", message);
      setNodes((nds) =>
        nds.map((node) =>
          node.id === message.node_id
            ? { ...node, position: { x: message.x, y: message.y } }
            : node
        )
      );
    }, []),

    // Handle incoming node creations from other users
    onNodeCreated: useCallback(
      (message) => {
        console.log("Node created by another user:", message);
        const nodeData = message.node_data;
        const newNode = {
          id: nodeData.id,
          type: "chat",
          position: { x: nodeData.x, y: nodeData.y },
          data: {
            label: nodeData.title || "New Node",
            messages: [],
            boardId: boardId,
            onAddNode: handleAddConnectedNode,
          },
        };
        setNodes((nds) => [...nds, newNode]);
      },
      [boardId]
    ),

    // Handle incoming node updates from other users (LLM responses, etc.)
    onNodeUpdated: useCallback((message) => {
      console.log("Node updated by another user:", message);
      console.log("Updates received:", message.updates);
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === message.node_id) {
            const updates = message.updates || {};
            const updatedData = { ...node.data, ...updates };
            console.log(`Updating node ${node.id} with data:`, updatedData);
            
            // Build updated node object
            const updatedNode = {
              ...node,
              data: updatedData,
            };
            
            // Handle width/height updates (these are node-level properties, not data properties)
            if (updates.width !== undefined) {
              updatedNode.width = updates.width;
            }
            if (updates.height !== undefined) {
              updatedNode.height = updates.height;
            }
            
            // Handle isCollapsed (stored in data)
            if (updates.isCollapsed !== undefined) {
              updatedData.isCollapsed = updates.isCollapsed;
            }
            
            return updatedNode;
          }
          return node;
        })
      );
    }, []),

    // Handle incoming node deletions from other users
    onNodeDeleted: useCallback((message) => {
      console.log("Node deleted by another user:", message);
      setNodes((nds) => nds.filter((node) => node.id !== message.node_id));
    }, []),

    // Handle incoming edge creations from other users
    onEdgeCreated: useCallback((message) => {
      console.log("Edge created by another user:", message);
      const edgeData = message.edge_data;
      const newEdge = {
        id: edgeData.id,
        source: edgeData.source_node_id,
        target: edgeData.target_node_id,
        type: edgeData.edge_type || "default",
      };
      setEdges((eds) => [...eds, newEdge]);
    }, []),

    // Handle incoming edge deletions from other users
    onEdgeDeleted: useCallback((message) => {
      console.log("Edge deleted by another user:", message);
      setEdges((eds) => eds.filter((edge) => edge.id !== message.edge_id));
    }, []),

    // Handle user join/leave events
    onUserJoined: useCallback((message) => {
      console.log("User joined board:", message.user_count, "users online");
      // Update the count of other users (total - 1 for yourself)
      // message.user_count is total users, so others = total - 1
      setOtherUsersCount(message.user_count - 1);
    }, []),

    onUserLeft: useCallback((message) => {
      console.log("User left board:", message.user_count, "users online");
      // Update the count of other users (total - 1 for yourself)
      setOtherUsersCount(message.user_count - 1);
    }, []),

    // Error handling
    onError: useCallback((message) => {
      console.error("WebSocket error:", message);
    }, []),

    // Handle incoming cursor updates from other users
    onCursorMoved: useCallback((message) => {
      console.log("[App] onCursorMoved callback called with:", message);
      if (handleCursorMoved) {
        handleCursorMoved(message);
      } else {
        console.warn("[App] handleCursorMoved is not available");
      }
    }, [handleCursorMoved]),
  });

  // Update the ref when sendMessage changes
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  // Node dimensions (approximate)
  const NODE_WIDTH = 400;
  const NODE_HEIGHT = 200;
  const PADDING = 50; // Minimum space between nodes

  // Ref
  const positionUpdateTimers = useRef({});

  // Check if a position collides with existing nodes
  const checkCollision = useCallback((position, allNodes, excludeId = null) => {
    const nodeBounds = {
      x: position.x,
      y: position.y,
      width: NODE_WIDTH + PADDING,
      height: NODE_HEIGHT + PADDING,
    };

    return allNodes.some((node) => {
      if (excludeId && node.id === excludeId) return false;
      const existingBounds = {
        x: node.position.x,
        y: node.position.y,
        width: NODE_WIDTH + PADDING,
        height: NODE_HEIGHT + PADDING,
      };

      return !(
        nodeBounds.x + nodeBounds.width < existingBounds.x ||
        nodeBounds.x > existingBounds.x + existingBounds.width ||
        nodeBounds.y + nodeBounds.height < existingBounds.y ||
        nodeBounds.y > existingBounds.y + existingBounds.height
      );
    });
  }, []);

  // Find nearest empty space using spiral search
  const findEmptySpace = useCallback(
    (startPosition, allNodes, maxAttempts = 20) => {
      const step = 100;
      let attempts = 0;

      // Try the start position first
      if (!checkCollision(startPosition, allNodes)) {
        return startPosition;
      }

      // Spiral outward from start position
      for (let radius = step; radius <= step * maxAttempts; radius += step) {
        const positions = [
          { x: startPosition.x + radius, y: startPosition.y }, // Right
          { x: startPosition.x - radius, y: startPosition.y }, // Left
          { x: startPosition.x, y: startPosition.y + radius }, // Bottom
          { x: startPosition.x, y: startPosition.y - radius }, // Top
          { x: startPosition.x + radius, y: startPosition.y + radius }, // Bottom-right
          { x: startPosition.x - radius, y: startPosition.y - radius }, // Top-left
          { x: startPosition.x + radius, y: startPosition.y - radius }, // Top-right
          { x: startPosition.x - radius, y: startPosition.y + radius }, // Bottom-left
        ];

        for (const pos of positions) {
          if (!checkCollision(pos, allNodes)) {
            return pos;
          }
          attempts++;
          if (attempts >= maxAttempts) break;
        }
        if (attempts >= maxAttempts) break;
      }

      // Fallback: return a position far from all nodes
      if (allNodes.length === 0) return startPosition;

      const maxX =
        Math.max(...allNodes.map((n) => n.position.x)) + NODE_WIDTH + PADDING;
      const maxY =
        Math.max(...allNodes.map((n) => n.position.y)) + NODE_HEIGHT + PADDING;
      return { x: maxX, y: maxY };
    },
    [checkCollision]
  );

  // Find the side with the most available space around a reference point
  const findSideWithMostSpace = useCallback(
    (referencePosition, allNodes) => {
      const offset = NODE_WIDTH + PADDING; // Distance to place node from reference

      // referencePosition is the center of the reference node
      // Calculate positions for each side (top-left corner of new node)
      const sides = [
        {
          position: {
            x: referencePosition.x - NODE_WIDTH / 2,
            y: referencePosition.y - NODE_HEIGHT - offset,
          },
          name: "top",
          availableSpace: Infinity,
          priority: 2, // Lower priority for vertical
        },
        {
          position: {
            x: referencePosition.x - NODE_WIDTH / 2,
            y: referencePosition.y + offset,
          },
          name: "bottom",
          availableSpace: Infinity,
          priority: 2, // Lower priority for vertical
        },
        {
          position: {
            x: referencePosition.x - NODE_WIDTH - offset,
            y: referencePosition.y - NODE_HEIGHT / 2,
          },
          name: "left",
          availableSpace: Infinity,
          priority: 1, // Higher priority for horizontal
        },
        {
          position: {
            x: referencePosition.x + offset,
            y: referencePosition.y - NODE_HEIGHT / 2,
          },
          name: "right",
          availableSpace: Infinity,
          priority: 1, // Higher priority for horizontal
        },
      ];

      // Calculate available space for each side
      for (const side of sides) {
        // First check if the position itself is collision-free
        if (checkCollision(side.position, allNodes)) {
          side.availableSpace = 0;
          continue;
        }

        // Calculate distance to nearest node in that direction
        let minDistance = Infinity;

        for (const node of allNodes) {
          const nodeLeft = node.position.x;
          const nodeRight = node.position.x + (node.width || NODE_WIDTH);
          const nodeTop = node.position.y;
          const nodeBottom = node.position.y + (node.height || NODE_HEIGHT);

          const sideLeft = side.position.x;
          const sideRight = side.position.x + NODE_WIDTH;
          const sideTop = side.position.y;
          const sideBottom = side.position.y + NODE_HEIGHT;

          let distance = Infinity;

          if (side.name === "top") {
            // Check if node overlaps horizontally and is above
            if (!(nodeRight < sideLeft || nodeLeft > sideRight)) {
              if (nodeBottom <= sideTop) {
                distance = sideTop - nodeBottom;
              }
            }
          } else if (side.name === "bottom") {
            // Check if node overlaps horizontally and is below
            if (!(nodeRight < sideLeft || nodeLeft > sideRight)) {
              if (nodeTop >= sideBottom) {
                distance = nodeTop - sideBottom;
              }
            }
          } else if (side.name === "left") {
            // Check if node overlaps vertically and is to the left
            if (!(nodeBottom < sideTop || nodeTop > sideBottom)) {
              if (nodeRight <= sideLeft) {
                distance = sideLeft - nodeRight;
              }
            }
          } else if (side.name === "right") {
            // Check if node overlaps vertically and is to the right
            if (!(nodeBottom < sideTop || nodeTop > sideBottom)) {
              if (nodeLeft >= sideRight) {
                distance = nodeLeft - sideRight;
              }
            }
          }

          if (distance < minDistance) {
            minDistance = distance;
          }
        }

        // If no nodes in that direction, set to a large value
        side.availableSpace = minDistance === Infinity ? 10000 : minDistance;
      }

      // ALWAYS prefer horizontal placement - try right first, then left
      // Only use vertical (top/bottom) as absolute last resort

      // Try right side first
      const rightSide = sides.find((s) => s.name === "right");
      if (rightSide && !checkCollision(rightSide.position, allNodes)) {
        return rightSide.position;
      }

      // Try left side second
      const leftSide = sides.find((s) => s.name === "left");
      if (leftSide && !checkCollision(leftSide.position, allNodes)) {
        return leftSide.position;
      }

      // If both horizontal sides are blocked, try to find space near them
      if (rightSide) {
        const rightSpace = findEmptySpace(rightSide.position, allNodes);
        if (rightSpace && !checkCollision(rightSpace, allNodes)) {
          return rightSpace;
        }
      }

      if (leftSide) {
        const leftSpace = findEmptySpace(leftSide.position, allNodes);
        if (leftSpace && !checkCollision(leftSpace, allNodes)) {
          return leftSpace;
        }
      }

      // Only use vertical as absolute last resort
      const topSide = sides.find((s) => s.name === "top");
      const bottomSide = sides.find((s) => s.name === "bottom");

      if (bottomSide && !checkCollision(bottomSide.position, allNodes)) {
        return bottomSide.position;
      }

      if (topSide && !checkCollision(topSide.position, allNodes)) {
        return topSide.position;
      }

      // Final fallback - use the side with most space
      const bestSide = sides.reduce((best, current) => {
        if (current.availableSpace > best.availableSpace) {
          return current;
        }
        return best;
      });

      // If the best side position has a collision, find empty space nearby
      if (checkCollision(bestSide.position, allNodes)) {
        return findEmptySpace(bestSide.position, allNodes);
      }

      return bestSide.position;
    },
    [checkCollision, findEmptySpace]
  );

  // Find emptiest space closest to target point (for viewport-centered placement)
  const findClosestEmptySpace = useCallback(
    (targetPosition, allNodes, maxRadius = 2000) => {
      const step = 100;
      let bestPosition = null;
      let bestDistance = Infinity;

      // Try the target position first
      if (!checkCollision(targetPosition, allNodes)) {
        return targetPosition;
      }

      // Search in expanding circles from target
      for (let radius = step; radius <= maxRadius; radius += step) {
        const positions = [];

        // Generate positions in a circle pattern
        for (let angle = 0; angle < 360; angle += 15) {
          const rad = (angle * Math.PI) / 180;
          positions.push({
            x: targetPosition.x + radius * Math.cos(rad),
            y: targetPosition.y + radius * Math.sin(rad),
          });
        }

        // Check each position and track the closest empty one
        for (const pos of positions) {
          if (!checkCollision(pos, allNodes)) {
            const distance = Math.sqrt(
              Math.pow(pos.x - targetPosition.x, 2) +
                Math.pow(pos.y - targetPosition.y, 2)
            );
            if (distance < bestDistance) {
              bestDistance = distance;
              bestPosition = pos;
            }
          }
        }

        // If we found a position, return it (closest one found so far)
        if (bestPosition) {
          return bestPosition;
        }
      }

      // Fallback: return target position or far from all nodes
      if (allNodes.length === 0) return targetPosition;

      const maxX =
        Math.max(...allNodes.map((n) => n.position.x)) + NODE_WIDTH + PADDING;
      const maxY =
        Math.max(...allNodes.map((n) => n.position.y)) + NODE_HEIGHT + PADDING;
      return { x: maxX, y: maxY };
    },
    [checkCollision]
  );

  // Handler for adding a new connected node
  const handleAddConnectedNode = useCallback(
    async (sourceNodeId, direction) => {
      // Ensure board ID exists
      if (!boardId) {
        console.error("No board selected");
        return;
      }

      // Get current nodes to calculate position
      let sourceNode = null;
      let currentNodes = [];

      setNodes((nds) => {
        currentNodes = nds;
        sourceNode = nds.find((n) => n.id === sourceNodeId);
        return nds; // Don't modify yet
      });

      if (!sourceNode) return;

      // Different offsets for vertical vs horizontal directions
      // Node width is ~400px, so horizontal needs more space
      const verticalOffset = 500; // For Top/Bottom
      const horizontalOffset = 500; // For Left/Right

      let newPosition = { ...sourceNode.position };

      switch (direction) {
        case Position.Top:
          newPosition.y -= verticalOffset;
          break;
        case Position.Bottom:
          newPosition.y += verticalOffset;
          break;
        case Position.Right:
          newPosition.x += horizontalOffset;
          break;
        case Position.Left:
          newPosition.x -= horizontalOffset;
          break;
        default:
          newPosition.x += horizontalOffset;
      }

      // Find empty space for the new node
      const finalPosition = findEmptySpace(newPosition, currentNodes);

      try {
        const newNodeId = `node-${Date.now()}`;
        const newNode = {
          id: newNodeId,
          board_id: boardId,
          x: finalPosition.x,
          y: finalPosition.y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          title: "New Node",
          prompt: null,
          role: "user",
          is_root: false,
          is_collapsed: false,
          is_starred: false,
          model: "gemini-pro",
        };

        console.log("New node created in the backend locally: ", newNode);

        const newEdgeId = `edge-${Date.now()}`;
        const newEdge = {
          id: newEdgeId,
          board_id: boardId,
          source_node_id: sourceNodeId,
          target_node_id: newNodeId,
          edge_type: `default`,
        };

        console.log(
          "New edge created connecting" + sourceNodeId + " to " + newNodeId
        );

        try {
          const newNodeResponse = await nodeAPI.createNode(boardId, newNode);
          console.log("New node created in the backend: ", newNodeResponse);

          // *** ADD THIS: Broadcast to other users ***
          if (isConnected) {
            sendMessage({
              type: "node_created",
              node_data: newNodeResponse,
            });
          }
        } catch (error) {
          console.error("Error creating node:", error);
          alert("Failed to create node");
        }

        try {
          const newEdgeResponse = await edgeAPI.createEdge(boardId, newEdge);
          console.log("New edge created in the backend: ", newEdgeResponse);

          // *** ADD THIS: Broadcast to other users ***
          if (isConnected) {
            sendMessage({
              type: "edge_created",
              edge_data: newEdgeResponse,
            });
          }
        } catch (error) {
          console.error("Error creating edge:", error);
          alert("Failed to create edge");
        }

        // 3. Update local state (optimistic UI)
        const newNodeLocal = {
          id: newNodeId,
          type: "chat",
          position: finalPosition,
          data: {
            label: "New Node",
            messages: [],
            boardId: boardId,
            onAddNode: handleAddConnectedNode,
            sendWebSocketMessage: sendMessage,
          },
        };

        const newEdgeLocal = {
          id: newEdgeId,
          source: sourceNodeId,
          target: newNodeId,
          sourceHandle: `source-${direction}`,
          targetHandle: `target-${getOppositeDirection(direction)}`,
          type: "default",
        };

        setNodes((nds) => nds.concat(newNodeLocal));
        setEdges((eds) => addEdge(newEdgeLocal, eds));

        // Smoothly animate to the new node
        setTimeout(() => {
          const nodeWidth = NODE_WIDTH;
          const nodeHeight = NODE_HEIGHT;
          setCenter(
            finalPosition.x + nodeWidth / 2,
            finalPosition.y + nodeHeight / 2,
            { zoom: 1.2, duration: 400 }
          );
        }, 0);
      } catch (error) {
        console.error("Error creating node/edge:", error);
        alert(`Failed to create node: ${error.message}`);
      }
    },
    [findEmptySpace, setEdges, boardId, setCenter]
  );

  // Helper to get opposite direction for target handle
  const getOppositeDirection = (direction) => {
    switch (direction) {
      case Position.Top:
        return Position.Bottom;
      case Position.Bottom:
        return Position.Top;
      case Position.Right:
        return Position.Left;
      case Position.Left:
        return Position.Right;
      default:
        return Position.Top;
    }
  };

  // ********** NEW CODE HERE ********** JOWEJFIOWEJFIOWEFJOWIEFJIOFJWEOFIJWEOFIJEWFIOWJOWEIJFOIEFJWOEFIJ
  const loadBoardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsLoadingFading(false);
      console.log("Loading board:", boardId);

      // Call the GET endpoint
      const boardData = await boardAPI.getBoard(boardId);

      // Get board name from the board data
      if (boardData.board && boardData.board.name) {
        setCurrentBoardName(boardData.board.name);
      } else if (boardData.name) {
        setCurrentBoardName(boardData.name);
      } else {
        // If name not in response, fetch all boards to get the name
        try {
          const boards = await boardAPI.getBoards();
          const board = boards.find((b) => b.id === boardId);
          if (board) {
            setCurrentBoardName(board.name);
          }
        } catch (error) {
          console.error("Failed to fetch board name:", error);
        }
      }

      console.log("Board data received:", boardData);

      // Convert database nodes to React Flow format
      const flowNodes = (boardData.nodes || []).map((node) => ({
        id: node.id,
        type: "chat",
        position: { x: node.x, y: node.y },
        data: {
          label: node.title || "New Chat",
          messages: (() => {
            const msgs = [];
            // Add user message if prompt exists
            if (node.prompt) {
              msgs.push({ role: "user", content: node.prompt });
            }
            // Add assistant message if response exists
            if (node.response) {
              msgs.push({ role: "assistant", content: node.response });
            }
            return msgs;
          })(),
          model: node.model || "gpt-4o",
          isRoot: node.is_root || false,
          isStarred: node.is_starred || false,
          isCollapsed: node.is_collapsed || false,  // NEW: Include is_collapsed from backend
          isResponded: node.is_responded || false,  // NEW: Include is_responded from backend
          boardId: boardId,
          onAddNode: handleAddConnectedNode,
          sendWebSocketMessage: sendMessage,
        },
        width: node.width,
        height: node.height,
      }));

      // Convert database edges to React Flow format
      const flowEdges = (boardData.edges || []).map((edge) => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        type: edge.edge_type || "default",
        style: { strokeWidth: 2 },
      }));

      console.log("Converted nodes:", flowNodes);
      console.log("Converted edges:", flowEdges);

      // Update state with loaded data
      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (error) {
      console.error("Failed to load board:", error);
      // If board doesn't exist, you might want to create it or show an error
      // For now, just log the error
      setNodes([]);
      setEdges([]);
    } finally {
      // Trigger fade-out animation
      setIsLoadingFading(true);
      // After fade animation completes, hide loading screen
      setTimeout(() => {
        setIsLoading(false);
        setIsLoadingFading(false);
      }, 500); // Match the fade duration
    }
  }, [boardId, handleAddConnectedNode]);

  // Function to switch to a different board
  const switchBoard = useCallback(async (newBoardId) => {
    setBoardId(newBoardId);
    // loadBoardData will be called automatically via useEffect when boardId changes
  }, []);

  // Initial Nodes State
  const initialNodes = [
    {
      id: "node-1",
      type: "chat",
      position: { x: 100, y: 100 },
      data: {
        label: "New Node",
        model: "gemini-pro",
        messages: [],
        isRoot: true, // Mark as root node
        onAddNode: handleAddConnectedNode, // Inject handler
      },
    },
  ];

  const [nodes, setNodes] = useState(initialNodes);

  // Handle dark mode class on html/body
  useEffect(() => {
    if (colorMode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [colorMode]);

  // Save color mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("colorMode", colorMode);
  }, [colorMode]);

  // Save sidebar collapse state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("isSidebarCollapsed", isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  // ********** NEW CODE HERE **********
  // Load board data on initial mount
  useEffect(() => {
    loadBoardData();
  }, [loadBoardData, boardId]);

  // Global keyboard shortcuts: Cmd/Ctrl + F to open search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => {
        const updatedNodes = applyNodeChanges(changes, nds);

        // Detect position changes and broadcast + update backend
        changes.forEach((change) => {
          if (
            change.type === "position" &&
            change.position &&
            !change.dragging
          ) {
            const nodeId = change.id;

            // 1. Broadcast to other users via WebSocket (real-time)
            if (isConnected) {
              sendMessage({
                type: "node_moved",
                node_id: nodeId,
                x: change.position.x,
                y: change.position.y,
              });
            }

            // 2. Update backend database (persistence)
            // Clear existing timer for this node
            if (positionUpdateTimers.current[nodeId]) {
              clearTimeout(positionUpdateTimers.current[nodeId]);
            }

            // Debounce: wait 500ms before sending update
            positionUpdateTimers.current[nodeId] = setTimeout(async () => {
              if (!boardId) return;

              try {
                await nodeAPI.updateNodePosition(boardId, nodeId, {
                  x: change.position.x,
                  y: change.position.y,
                });
                console.log(`Position updated in database for node ${nodeId}`);
              } catch (error) {
                console.error(
                  `Failed to update position for node ${nodeId}:`,
                  error
                );
              } finally {
                delete positionUpdateTimers.current[nodeId];
              }
            }, 500);
          }
        });

        return updatedNodes;
      });
    },
    [boardId, isConnected, sendMessage]
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // Determine optimal target handle - the side of target node that faces the source
  const getOptimalTargetHandle = useCallback((sourceNode, targetNode) => {
    if (!sourceNode || !targetNode) return Position.Top;

    // Get node centers
    const sourceCenterX = sourceNode.position.x + (sourceNode.width || 400) / 2;
    const sourceCenterY =
      sourceNode.position.y + (sourceNode.height || 200) / 2;
    const targetCenterX = targetNode.position.x + (targetNode.width || 400) / 2;
    const targetCenterY =
      targetNode.position.y + (targetNode.height || 200) / 2;

    // Calculate direction vector from target to source (which side faces the source)
    const dx = sourceCenterX - targetCenterX; // Positive = source is to the right
    const dy = sourceCenterY - targetCenterY; // Positive = source is below

    // Determine which side of target faces the source
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // If horizontal distance is greater, use left or right side
    if (absDx > absDy) {
      // If source is to the right, use target's RIGHT side (facing source)
      // If source is to the left, use target's LEFT side (facing source)
      return dx > 0 ? Position.Right : Position.Left;
    }
    // If vertical distance is greater, use top or bottom side
    else {
      // If source is below, use target's BOTTOM side (facing source)
      // If source is above, use target's TOP side (facing source)
      return dy > 0 ? Position.Bottom : Position.Top;
    }
  }, []);

  // Determine optimal source handle - the side of source node that faces the target
  const getOptimalSourceHandle = useCallback((sourceNode, targetNode) => {
    if (!sourceNode || !targetNode) return Position.Bottom;

    // Get node centers
    const sourceCenterX = sourceNode.position.x + (sourceNode.width || 400) / 2;
    const sourceCenterY =
      sourceNode.position.y + (sourceNode.height || 200) / 2;
    const targetCenterX = targetNode.position.x + (targetNode.width || 400) / 2;
    const targetCenterY =
      targetNode.position.y + (targetNode.height || 200) / 2;

    // Calculate direction vector from source to target (which side faces the target)
    const dx = targetCenterX - sourceCenterX; // Positive = target is to the right
    const dy = targetCenterY - sourceCenterY; // Positive = target is below

    // Determine which side of source faces the target
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // If horizontal distance is greater, use left or right side
    if (absDx > absDy) {
      // If target is to the right, use source's RIGHT side (facing target)
      // If target is to the left, use source's LEFT side (facing target)
      return dx > 0 ? Position.Right : Position.Left;
    }
    // If vertical distance is greater, use top or bottom side
    else {
      // If target is below, use source's BOTTOM side (facing target)
      // If target is above, use source's TOP side (facing target)
      return dy > 0 ? Position.Bottom : Position.Top;
    }
  }, []);

  // Optimize edge handles based on current node positions
  // This function recalculates optimal handles for all edges
  const optimizeEdgeHandles = useCallback(
    (currentNodes, currentEdges) => {
      return currentEdges.map((edge) => {
        const sourceNode = currentNodes.find((n) => n.id === edge.source);
        const targetNode = currentNodes.find((n) => n.id === edge.target);

        if (sourceNode && targetNode) {
          // Recalculate optimal handles based on current node positions
          const optimalSourcePosition = getOptimalSourceHandle(
            sourceNode,
            targetNode
          );
          const optimalTargetPosition = getOptimalTargetHandle(
            sourceNode,
            targetNode
          );

          return {
            ...edge,
            sourceHandle: `source-${optimalSourcePosition}`,
            targetHandle: `target-${optimalTargetPosition}`,
          };
        }

        // Return edge unchanged if nodes not found
        return edge;
      });
    },
    [getOptimalSourceHandle, getOptimalTargetHandle]
  );

  // Recalculate edge handles whenever nodes change (position, size, etc.)
  // This ensures that when a board is loaded from the database, all edges get optimal handles
  // Also recalculates when nodes are moved, ensuring handles always use optimal sides
  useEffect(() => {
    if (edges.length > 0 && nodes.length > 0) {
      setEdges((currentEdges) => {
        const optimizedEdges = optimizeEdgeHandles(nodes, currentEdges);
        // Only update if handles actually changed (avoid unnecessary re-renders)
        const needsUpdate = optimizedEdges.some((optEdge, idx) => {
          const currentEdge = currentEdges[idx];
          return (
            !currentEdge ||
            optEdge.sourceHandle !== currentEdge.sourceHandle ||
            optEdge.targetHandle !== currentEdge.targetHandle
          );
        });

        return needsUpdate ? optimizedEdges : currentEdges;
      });
    }
  }, [nodes, optimizeEdgeHandles]); // Recalculate when nodes change (positions, sizes, etc.)

  const onConnect = useCallback(
    (params) => {
      // Get source and target nodes
      const sourceNode = getNode(params.source);
      const targetNode = getNode(params.target);

      if (sourceNode && targetNode) {
        // Determine optimal source and target handles based on node positions
        // This ensures the connection uses the best sides regardless of which handles were dragged
        const optimalSourcePosition = getOptimalSourceHandle(
          sourceNode,
          targetNode
        );
        const optimalTargetPosition = getOptimalTargetHandle(
          sourceNode,
          targetNode
        );

        // Override both handles with optimal ones
        // This way we don't need to store which side was used - frontend determines it
        const optimizedParams = {
          ...params,
          sourceHandle: `source-${optimalSourcePosition}`,
          targetHandle: `target-${optimalTargetPosition}`,
          style: { strokeWidth: 2 }, // Double thickness
        };

        setEdges((eds) => addEdge(optimizedParams, eds));
      } else {
        // Fallback to original params if nodes not found
        setEdges((eds) =>
          addEdge(
            {
              ...params,
              style: { strokeWidth: 2 }, // Double thickness
            },
            eds
          )
        );
      }
    },
    [getNode, getOptimalSourceHandle, getOptimalTargetHandle]
  );

  const toggleColorMode = useCallback(() => {
    setColorMode((mode) => (mode === "light" ? "dark" : "light"));
  }, []);

  const onAddNode = useCallback(() => {
    setNodes((currentNodes) => {
      let referencePosition;

      if (currentNodes.length === 0) {
        // If canvas is empty, use viewport center
        const viewport = getViewport();
        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;
        referencePosition = {
          x: (screenCenterX - viewport.x) / viewport.zoom,
          y: (screenCenterY - viewport.y) / viewport.zoom,
        };
      } else {
        // Use the most recently added node (last in array) as reference
        // Use the node's center position
        const lastNode = currentNodes[currentNodes.length - 1];
        referencePosition = {
          x: lastNode.position.x + (lastNode.width || NODE_WIDTH) / 2,
          y: lastNode.position.y + (lastNode.height || NODE_HEIGHT) / 2,
        };
      }

      // Find the side with the most available space
      // Prefer horizontal (left/right) placement
      const finalPosition = findSideWithMostSpace(
        referencePosition,
        currentNodes
      );

      // If canvas is empty, make this node the root node
      const isRoot = currentNodes.length === 0;

      const newNode = {
        id: `node-${Date.now()}`,
        type: "chat",
        position: finalPosition,
        data: {
          label: "New Node",
          messages: [],
          isRoot: isRoot, // Mark as root if canvas is empty
          boardId: boardId, // Pass the board ID to the node
          onAddNode: handleAddConnectedNode, // Ensure new manual nodes also have the handler
        },
      };
      const newNodes = currentNodes.concat(newNode);

      // Fit view to show the new node
      setTimeout(() => {
        const nodeWidth = newNode.width || 400;
        const nodeHeight = newNode.height || 200;
        setCenter(
          finalPosition.x + nodeWidth / 2,
          finalPosition.y + nodeHeight / 2,
          { zoom: 1.2, duration: 400 }
        );
      }, 0);

      return newNodes;
    });
  }, [
    handleAddConnectedNode,
    findSideWithMostSpace,
    getViewport,
    setCenter,
    boardId,
  ]);

  const onClear = useCallback(() => {
    // Clear all nodes except root nodes, and reset root nodes to default state
    setNodes((currentNodes) => {
      const rootNodes = currentNodes.filter(
        (node) => node.data?.isRoot === true
      );

      // Reset root nodes to default state
      const resetRootNodes = rootNodes.map((node) => ({
        ...node,
        position: { x: 100, y: 100 }, // Default position
        data: {
          ...node.data,
          messages: [], // Clear messages
          label: "New Node", // Reset label
          model: "gemini-pro", // Default model
          isStarred: false, // Reset star
          isCollapsed: false, // Reset collapse
          onAddNode: handleAddConnectedNode, // Ensure handler is present
        },
        width: 400, // Default width
        height: null, // Default height (auto)
      }));

      // If no root nodes exist, create a default one
      const finalNodes =
        resetRootNodes.length > 0
          ? resetRootNodes
          : [
              {
                id: "node-1",
                type: "chat",
                position: { x: 100, y: 100 },
                data: {
                  label: "New Node",
                  model: "gemini-pro",
                  messages: [],
                  isRoot: true,
                  onAddNode: handleAddConnectedNode,
                },
                width: 400,
                height: null,
              },
            ];

      // Jump to the root node position
      setTimeout(() => {
        const rootNode = finalNodes[0];
        if (rootNode) {
          const nodeWidth = rootNode.width || 400;
          const nodeHeight = rootNode.height || 200;
          setCenter(
            rootNode.position.x + nodeWidth / 2,
            rootNode.position.y + nodeHeight / 2,
            { zoom: 1.2, duration: 400 }
          );
        }
      }, 0);

      return finalNodes;
    });

    // Clear edges
    setEdges([]);
  }, [setCenter, handleAddConnectedNode]);

  const onSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const handleSelectNode = useCallback(
    (nodeId) => {
      const node = getNode(nodeId);
      if (node) {
        // Center the viewport on the selected node with smooth animation
        // Account for node dimensions to center it properly
        const nodeWidth = node.width || 400;
        const nodeHeight = node.height || 200;
        setCenter(
          node.position.x + nodeWidth / 2,
          node.position.y + nodeHeight / 2,
          { zoom: 1.2, duration: 400 }
        );
      }
    },
    [getNode, setCenter]
  );

  // Jump to base/root node with zoom 1.2
  const jumpToBaseNode = useCallback(() => {
    const rootNode =
      nodes.find((node) => node.data?.isRoot === true) || nodes[0];
    if (rootNode) {
      const nodeWidth = rootNode.width || 400;
      const nodeHeight = rootNode.height || 200;
      setCenter(
        rootNode.position.x + nodeWidth / 2,
        rootNode.position.y + nodeHeight / 2,
        { zoom: 1.2, duration: 400 }
      );
    }
  }, [nodes, setCenter]);

  // Set initial viewport to base node with zoom 1.2
  useEffect(() => {
    if (initialNodes.length > 0) {
      const rootNode =
        initialNodes.find((node) => node.data?.isRoot === true) ||
        initialNodes[0];
      if (rootNode) {
        const nodeWidth = rootNode.width || 400;
        const nodeHeight = rootNode.height || 200;
        setTimeout(() => {
          setCenter(
            rootNode.position.x + nodeWidth / 2,
            rootNode.position.y + nodeHeight / 2,
            { zoom: 1.2, duration: 0 }
          );
        }, 100);
      }
    }
  }, [setCenter]); // Only run on initial mount

  return (
    <Layout
      onBoardSwitch={switchBoard}
      currentBoardId={boardId}
      isSidebarCollapsed={isSidebarCollapsed}
      onSidebarCollapseChange={setIsSidebarCollapsed}
      colorMode={colorMode}
    >
      {isLoading ? (
        <div
          className={`flex items-center justify-center h-screen transition-opacity duration-500 ${
            isLoadingFading ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex items-center gap-3">
            {/* Spinning Logo */}
            <img
              src="/weaverw.svg"
              alt="weaver logo"
              className="w-6 h-6 animate-flip-turn-accumulate brightness-0 dark:brightness-0 dark:invert"
            />
            {/* weaver text */}
            <h1
              className="text-xl text-neutral-900 dark:text-neutral-200"
              style={{
                fontFamily: "'Azeret Mono', monospace",
                fontWeight: 400,
              }}
            >
              weaver
            </h1>
          </div>
        </div>
      ) : (
        <>
          <Hotbar
            onAddNode={onAddNode}
            onClear={onClear}
            onFitView={() => fitView({ duration: 400 })}
            onSearch={onSearch}
            onToggleTheme={toggleColorMode}
            colorMode={colorMode}
          />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{
              style: { strokeWidth: 2 },
            }}
            fitView
            proOptions={{ hideAttribution: true }}
            colorMode={colorMode}
          >
            <Background
              bgColor={colorMode === "dark" ? "#0f0f0f" : "#f5f5f5"}
              color={colorMode === "dark" ? "#3a3a3a" : "#b0b0b0"}
              gap={20}
              size={1}
            />
            <MiniMap pannable zoomable />

            {/* Render other users' cursors - convert flow coordinates to screen coordinates */}
            {Array.from(otherUsersCursors.entries()).map(([userId, cursor]) => {
              // Convert flow coordinates to screen coordinates (relative to pane)
              const screenPosition = flowToScreenPosition({ x: cursor.x, y: cursor.y });
              
              // Get the pane element to ensure correct positioning context
              const paneElement = document.querySelector('.react-flow__pane');
              const paneRect = paneElement?.getBoundingClientRect();
              
              return (
                <div
                  key={userId}
                  className="absolute pointer-events-none z-50"
                  style={{
                    // If pane exists, position relative to it; otherwise use screenPosition directly
                    left: paneRect ? `${screenPosition.x}px` : `${screenPosition.x}px`,
                    top: paneRect ? `${screenPosition.y}px` : `${screenPosition.y}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  {/* Cursor dot */}
                  <div
                    className="text-2xl leading-none"
                    style={{
                      color: getColorForUser(userId),
                      filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))",
                    }}
                  >
                    ●
                  </div>
                  {/* User label */}
                  <div
                    className="mt-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap"
                    style={{
                      backgroundColor: getColorForUser(userId),
                      color: "#FFFFFF",
                      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                      transform: "translateX(-50%)",
                      position: "relative",
                      left: "50%",
                    }}
                  >
                    {userId.substring(0, 8)}...
                  </div>
                </div>
              );
            })}
          </ReactFlow>
          {/* Floating weaver text in corner */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <h1
              className="text-xl text-neutral-900 dark:text-neutral-200"
              style={{
                fontFamily: "'Azeret Mono', monospace",
                fontWeight: 400,
              }}
            >
              weaver
            </h1>
          </div>
          {/* Connection status - bottom left */}
          <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
            {isConnected && (
              <div className="text-xs font-mono text-green-500">
                ● Connected ({otherUsersCount} {otherUsersCount === 1 ? 'other' : 'others'} online)
              </div>
            )}
            {!isConnected && (
              <div className="text-xs font-mono text-red-500">
                ● Disconnected
              </div>
            )}
          </div>
          {/* Search Modal */}
          <SearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            nodes={nodes}
            onSelectNode={handleSelectNode}
            colorMode={colorMode}
          />
        </>
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
