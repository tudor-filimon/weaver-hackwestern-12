import { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import ChatNode from './components/ChatNode.jsx';
import Layout from './components/Layout.jsx';
import Hotbar from './components/Hotbar.jsx';

const nodeTypes = { chat: ChatNode };

function Flow() {
  // Define handlers first so we can pass them to initial state if needed, 
  // but typically we inject them via effects or map over state.
  
  const { fitView, getNode, getViewport } = useReactFlow();
  const [edges, setEdges] = useState([]);
  const [colorMode, setColorMode] = useState('dark');

  // Node dimensions (approximate)
  const NODE_WIDTH = 400;
  const NODE_HEIGHT = 200;
  const PADDING = 50; // Minimum space between nodes

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
  const findEmptySpace = useCallback((startPosition, allNodes, maxAttempts = 20) => {
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
    
    const maxX = Math.max(...allNodes.map(n => n.position.x)) + NODE_WIDTH + PADDING;
    const maxY = Math.max(...allNodes.map(n => n.position.y)) + NODE_HEIGHT + PADDING;
    return { x: maxX, y: maxY };
  }, [checkCollision]);

  // Find emptiest space closest to target point (for viewport-centered placement)
  const findClosestEmptySpace = useCallback((targetPosition, allNodes, maxRadius = 2000) => {
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
    
    const maxX = Math.max(...allNodes.map(n => n.position.x)) + NODE_WIDTH + PADDING;
    const maxY = Math.max(...allNodes.map(n => n.position.y)) + NODE_HEIGHT + PADDING;
    return { x: maxX, y: maxY };
  }, [checkCollision]);

  // Handler for adding a new connected node
  const handleAddConnectedNode = useCallback((sourceNodeId, direction) => {
    setNodes((currentNodes) => {
      const sourceNode = currentNodes.find(n => n.id === sourceNodeId);
      if (!sourceNode) return currentNodes;

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

      const newNodeId = `node-${Date.now()}`;
      const newNode = {
        id: newNodeId,
        type: 'chat',
        position: finalPosition,
        data: { 
          label: 'New Node', 
          messages: [],
          onAddNode: handleAddConnectedNode // Pass the function recursively
        },
      };

      const newEdge = {
        id: `e-${sourceNodeId}-${newNodeId}`,
        source: sourceNodeId,
        target: newNodeId,
        sourceHandle: `source-${direction}`, // Correctly reference the unique handle ID
        targetHandle: `target-${getOppositeDirection(direction)}`, // Connect to the opposite target handle
        type: 'default',
      };

      setEdges((eds) => addEdge(newEdge, eds));
      return currentNodes.concat(newNode);
    });
  }, [findEmptySpace, setEdges]);

  // Helper to get opposite direction for target handle
  const getOppositeDirection = (direction) => {
    switch (direction) {
      case Position.Top: return Position.Bottom;
      case Position.Bottom: return Position.Top;
      case Position.Right: return Position.Left;
      case Position.Left: return Position.Right;
      default: return Position.Top;
    }
  };

  // Initial Nodes State
  const [nodes, setNodes] = useState([
    { 
      id: 'node-1', 
      type: 'chat', 
      position: { x: 100, y: 100 }, 
      data: { 
        label: 'New Node', 
        model: 'gemini-pro',
        messages: [],
        isRoot: true, // Mark as root node
        onAddNode: handleAddConnectedNode // Inject handler
      } 
    },
  ]);

  // Handle dark mode class on html/body
  useEffect(() => {
    if (colorMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [colorMode]);

  // Apply dark mode on initial mount
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [],
  );

  const toggleColorMode = useCallback(() => {
    setColorMode((mode) => (mode === 'light' ? 'dark' : 'light'));
  }, []);

  const onAddNode = useCallback(() => {
    setNodes((currentNodes) => {
      // Get viewport center in world coordinates
      const viewport = getViewport();
      // Convert screen center to flow coordinates
      // viewport has { x, y, zoom } where x,y are pan values
      // Screen center in flow coordinates = (screenX - x) / zoom
      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;
      const viewportCenter = {
        x: (screenCenterX - viewport.x) / viewport.zoom,
        y: (screenCenterY - viewport.y) / viewport.zoom,
      };

      // Find the emptiest space closest to viewport center
      const finalPosition = findClosestEmptySpace(viewportCenter, currentNodes);

      // If canvas is empty, make this node the root node
      const isRoot = currentNodes.length === 0;

      const newNode = {
        id: `node-${Date.now()}`,
        type: 'chat',
        position: finalPosition,
        data: { 
          label: 'New Node', 
          messages: [],
          isRoot: isRoot, // Mark as root if canvas is empty
          onAddNode: handleAddConnectedNode // Ensure new manual nodes also have the handler
        },
      };
      return currentNodes.concat(newNode);
    });
  }, [handleAddConnectedNode, findClosestEmptySpace, getViewport]);

  const onClear = useCallback(() => {
    // Keep root nodes, remove all others
    setNodes((currentNodes) => currentNodes.filter(node => node.data?.isRoot === true));
    setEdges([]);
  }, []);

  const onSearch = useCallback(() => {
    // Placeholder for search functionality
    console.log('Search nodes');
  }, []);

  return (
    <Layout>
      <Hotbar 
        onAddNode={onAddNode} 
        onClear={onClear} 
        onFitView={() => fitView()}
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
        fitView
        proOptions={{ hideAttribution: true }}
        colorMode={colorMode}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
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
