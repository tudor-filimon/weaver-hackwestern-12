import React, { useCallback, useState, useRef, useEffect } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import {
  ArrowUp,
  GripVertical,
  Flag,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
} from "lucide-react";

import { nodeAPI } from "../utils/api"; // Connecting to backend

const ChatMessage = ({ role, content }) => (
  <div
    className={`flex ${
      role === "user" ? "justify-end" : "justify-start"
    } mb-3 nodrag`}
  >
    <div
      className={`max-w-[90%] px-4 py-2.5 rounded-3xl text-sm ${
        role === "user"
          ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 select-none cursor-default"
          : "text-neutral-800 dark:text-neutral-200 select-text cursor-text"
      }`}
    >
      {content}
    </div>
  </div>
);

// Helper for the side controls (Handle + Add Button)
const SideControl = ({ position, isConnectable, onAddNode, isCollapsed }) => {
  // Invisible Hit Area - positioned to just cover the edge and extend outward
  // Extended to accommodate the sliding button without losing hover
  // When collapsed, the node is shorter, so hit areas adjust accordingly
  // Top hit area starts below header to avoid conflicts with header buttons
  // Right hit area starts from top but avoids delete button area in top-right corner
  const hitAreaClasses = {
    [Position.Top]: "-top-4 left-0 w-full h-20", // Extended to h-20 (80px) to cover slide-out button
    [Position.Right]: "-right-4 top-0 w-20 h-full", // Extended to w-20 (80px) to cover slide-out button
    [Position.Bottom]: "-bottom-4 left-0 w-full h-20", // Extended to h-20 (80px) to cover slide-out button
    [Position.Left]: "-left-4 top-0 w-20 h-full", // Extended to w-20 (80px) to cover slide-out button
  };

  // Get the correct style override for each position to place handle exactly on edge
  const getHandleStyle = () => {
    const handleSize = 14.4; // 20% bigger than 12px (12 * 1.2 = 14.4px)
    const handleOffset = handleSize / 2; // Half handle size to center it
    const hitAreaOffset = 16; // Hit area extends 16px outside (top-4 = 16px)
    // To sit on node edge: move from hit area edge (+16px) then center handle (-6px) = +10px
    // Add extra offset to move further inward if React Flow adds its own offset
    const extraOffset = 4; // Additional offset to move handle further inward
    const outwardOffset = 3; // Move handle 3px outward from edge
    const topBottomOffset =
      hitAreaOffset - handleOffset + extraOffset - outwardOffset; // 16 - 7.2 + 4 - 3 = 9.8px
    const leftRightOffset =
      hitAreaOffset - handleOffset + extraOffset - outwardOffset; // Same for left/right

    // When collapsed, the node is shorter, so adjust positioning
    // For collapsed nodes, position handles relative to the header height instead of 50%
    if (isCollapsed) {
      // Header height: py-4 (16px top + 16px bottom = 32px) + content (~20px) = ~52px total
      // Center point is approximately 26px from top
      const collapsedCenter = 26;

      switch (position) {
        case Position.Top:
          return {
            top: `${topBottomOffset}px`,
            left: "50%",
            transform: "translateX(-50%)",
            position: "absolute",
          };
        case Position.Right:
          return {
            right: `${leftRightOffset}px`,
            top: `${collapsedCenter}px`,
            transform: "translateY(-50%)",
            position: "absolute",
          };
        case Position.Bottom:
          return {
            bottom: `${topBottomOffset}px`,
            left: "50%",
            transform: "translateX(-50%)",
            position: "absolute",
          };
        case Position.Left:
          return {
            left: `${leftRightOffset}px`,
            top: `${collapsedCenter}px`,
            transform: "translateY(-50%)",
            position: "absolute",
          };
        default:
          return {};
      }
    }

    switch (position) {
      case Position.Top:
        return {
          top: `${topBottomOffset}px`,
          left: "50%",
          transform: "translateX(-50%)",
          position: "absolute",
        };
      case Position.Right:
        return {
          right: `${leftRightOffset}px`,
          top: "50%",
          transform: "translateY(-50%)",
          position: "absolute",
        };
      case Position.Bottom:
        return {
          bottom: `${topBottomOffset}px`,
          left: "50%",
          transform: "translateX(-50%)",
          position: "absolute",
        };
      case Position.Left:
        return {
          left: `${leftRightOffset}px`,
          top: "50%",
          transform: "translateY(-50%)",
          position: "absolute",
        };
      default:
        return {};
    }
  };

  // Plus button positioning - starts at handle position, slides out on hover
  // Button starts at the handle position and slides outward
  const plusButtonBaseClasses = {
    [Position.Top]: "top-0 left-1/2 -translate-x-1/2", // Start at handle position (top edge)
    [Position.Right]: "right-0 top-1/2 -translate-y-1/2", // Start at handle position (right edge)
    [Position.Bottom]: "bottom-0 left-1/2 -translate-x-1/2", // Start at handle position (bottom edge)
    [Position.Left]: "left-0 top-1/2 -translate-y-1/2", // Start at handle position (left edge)
  };

  // Slide out transforms for each position
  const slideOutTransforms = {
    [Position.Top]: "group-hover/hit:-translate-y-7", // Slide up 28px
    [Position.Right]: "group-hover/hit:translate-x-7", // Slide right 28px
    [Position.Bottom]: "group-hover/hit:translate-y-7", // Slide down 28px
    [Position.Left]: "group-hover/hit:-translate-x-7", // Slide left 28px
  };

  return (
    <div
      className={`absolute ${hitAreaClasses[position]} z-40 group/hit`}
      style={{ pointerEvents: "none" }}
    >
      {/* Hover detection area - only on outer edge, doesn't extend into content area */}
      <div
        className="absolute cursor-pointer"
        style={{
          pointerEvents: "auto",
          userSelect: "none",
          ...(position === Position.Top
            ? {
                left: "50%",
                top: "0",
                transform: "translateX(-50%)",
                width: "40px",
                height: "20px",
              }
            : position === Position.Bottom
            ? {
                left: "50%",
                bottom: "0",
                transform: "translateX(-50%)",
                width: "40px",
                height: "20px",
              }
            : position === Position.Left
            ? {
                top: "50%",
                left: "0",
                transform: "translateY(-50%)",
                width: "20px",
                height: "40px",
              }
            : {
                top: "50%",
                right: "0",
                transform: "translateY(-50%)",
                width: "20px",
                height: "40px",
              }),
        }}
      />

      {/* Handle - positioned exactly on the edge, directly in the hit area */}
      <Handle
        type="source"
        position={position}
        id={`source-${position}`}
        isConnectable={isConnectable}
        className="!w-[13px] !h-[13px] !bg-neutral-400 !border-2 !border-white dark:!border-neutral-900 hover:!bg-black dark:hover:!bg-white transition-colors opacity-0 group-hover/hit:opacity-100 transition-opacity duration-200 pointer-events-auto"
        style={getHandleStyle()}
      />

      {/* Plus Button - starts at handle, slides out on hover */}
      <div
        className={`absolute ${plusButtonBaseClasses[position]} opacity-0 group-hover/hit:opacity-100 transition-all duration-200 ${slideOutTransforms[position]} pointer-events-auto`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddNode(position);
          }}
          className="p-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full text-neutral-500 hover:text-black dark:hover:text-white hover:border-black dark:hover:border-white shadow-sm transition-all transform hover:scale-110 pointer-events-auto"
          title="Add Connected Node"
        >
          <Plus size={12} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};

const UniversalHandle = ({ position, isConnectable }) => (
  <Handle
    type="target"
    position={position}
    id={`target-${position}`}
    isConnectable={isConnectable}
    className="!w-3 !h-3 !opacity-0"
  />
);

export default function ChatNode({ data, id, isConnectable }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(data.messages || []);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [model, setModel] = useState(data.model || "gemini-pro");
  const [hasSent, setHasSent] = useState(messages.length > 0);
  const [isStarred, setIsStarred] = useState(data.isStarred || false);
  const isRoot = data.isRoot || false;

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(data.label || "New Node");

  const textareaRef = useRef(null);
  const titleInputRef = useRef(null);
  const resizeHandleRef = useRef(null);
  const nodeContainerRef = useRef(null);
  const { deleteElements, updateNode } = useReactFlow();

  // Node dimensions - default to 400px width, auto height
  const [nodeWidth, setNodeWidth] = useState(data.width ?? 400); // null means auto width
  const [nodeHeight, setNodeHeight] = useState(data.height ?? null); // null means auto height
  const [isResizing, setIsResizing] = useState(false);

  // Initialize dimensions from node data if available
  useEffect(() => {
    setNodeWidth(data.width ?? 400);
    setNodeHeight(data.height ?? null);
  }, [data.width, data.height]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditingTitle]);

  // ********** NEW CODE HERE **********
  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const userMessage = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    const currentInput = input;
    setInput("");
    setHasSent(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "..." }]);

    try {
      // Get board ID from node data or use a default
      const boardId = data.boardId || "board-001"; // You'll need to pass this from App.jsx

      // Send message to WebSocket
      if (data.sendWebSocketMessage) {
        data.sendWebSocketMessage({
          type: "node_updated",
          node_id: id,
          updates: {
            messages: newMessages,
          },
        });
      }

      // Call the API to get LLM response
      const response = await nodeAPI.updateNode(boardId, id, {
        id: id,
        prompt: currentInput,
      });

      // 3. Update local state with response
      const assistantMessage = {
        role: "assistant",
        content: response.response || "No response received",
      };

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: response.response || "No response received",
        };
        return updated;
      });

      const finalMessages = [...newMessages, assistantMessage];

      // Update node data with the response
      updateNode(id, {
        data: {
          ...data,
          messages: finalMessages,
        },
      });

      // 5. Broadcast to other users
      if (data.sendWebSocketMessage) {
        data.sendWebSocketMessage({
          type: "node_updated",
          node_id: id,
          updates: {
            messages: finalMessages,
          },
        });
      }
    } catch (error) {
      console.error("Failed to get AI response:", error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Error: ${error.message}`,
        };
        return updated;
      });
    }
  }, [input, messages, id, data, updateNode]);
  // ********** NEW CODE STOPS HERE **********

  const handleDelete = useCallback(async () => {
    // Get boardId from node data
    const boardId = data.boardId;

    if (!boardId) {
      console.error("No board ID available");
      deleteElements({ nodes: [{ id }] }); // Fallback to local delete
      return;
    }

    try {
      // 1. Delete from backend
      await nodeAPI.deleteNode(boardId, id);
      console.log(`Node ${id} deleted from backend`);

      // 2. Delete from UI (React Flow handles edge cleanup automatically)
      deleteElements({ nodes: [{ id }] });
    } catch (error) {
      console.error("Failed to delete node:", error);
      alert(`Failed to delete node: ${error.message}`);
    }
  }, [id, data, deleteElements]);

  const handleAddNode = useCallback(
    (direction) => {
      if (data.onAddNode) {
        data.onAddNode(id, direction);
      }
    },
    [data, id]
  );

  const handleTitleSubmit = useCallback(async () => {
    setIsEditingTitle(false);

    // Update the node data in React Flow
    updateNode(id, {
      data: {
        ...data,
        label: title,
      },
    });

    // Update the database via API
    try {
      const boardId = data.boardId || "board-001";
      await nodeAPI.updateNode(boardId, id, {
        title: title,
      });

      // Broadcast title change to other users
      if (data.sendWebSocketMessage) {
        data.sendWebSocketMessage({
          type: "node_updated",
          node_id: id,
          updates: {
            label: title,
          },
        });
      }
    } catch (error) {
      console.error("Failed to update title:", error);
      // Optionally revert the title on error
      setTitle(data.label || "New Node");
    }
  }, [title, id, data, updateNode]);
  // Resize handlers - supports both width and height
  const handleResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation(); // Stop all event propagation
      setIsResizing(true);
      const startX = e.clientX;
      const startY = e.clientY;
      // Get actual element dimensions instead of using state values (which might be null)
      const actualWidth = nodeContainerRef.current
        ? nodeContainerRef.current.offsetWidth
        : nodeWidth || 400;
      const actualHeight = nodeContainerRef.current
        ? nodeContainerRef.current.offsetHeight
        : nodeHeight || 200;
      const startWidth = actualWidth;
      const startHeight = actualHeight;

      const handleMouseMove = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const diffX = e.clientX - startX;
        const diffY = e.clientY - startY;

        // Calculate new dimensions
        // Min width 350px to ensure header controls (title, model selector, buttons) don't get cramped
        const newWidth = Math.max(350, Math.min(800, startWidth + diffX)); // Min 350px, max 800px
        const newHeight = Math.max(200, Math.min(1000, startHeight + diffY)); // Min 200px, max 1000px

        setNodeWidth(newWidth);
        setNodeHeight(newHeight);
        updateNode(id, { width: newWidth, height: newHeight });
      };

      const handleMouseUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove, {
        passive: false,
      });
      document.addEventListener("mouseup", handleMouseUp, { passive: false });
    },
    [id, nodeWidth, nodeHeight, updateNode]
  );

  // Root nodes have double border thickness (border-2 = 2px, so double = 4px)
  const borderWidthClass = isRoot ? "border-[4px]" : "border";
  const borderColorClass = isStarred
    ? "border-yellow-400"
    : "border-neutral-200 dark:border-neutral-800";

  return (
    <div
      ref={nodeContainerRef}
      className={`group/node relative bg-white dark:bg-neutral-900 rounded-[2rem] shadow-xl ${borderWidthClass} flex flex-col transition-colors duration-200 font-sans ${borderColorClass} ${
        isResizing ? "select-none" : ""
      }`}
      style={{
        ...(nodeWidth && { width: `${nodeWidth}px` }),
        // Only apply height when not collapsed - when collapsed, let it be auto (just header height)
        ...(nodeHeight && !isCollapsed && { height: `${nodeHeight}px` }),
        // Ensure minimum width to prevent controls from overlapping
        minWidth: "450px",
        // Ensure minimum height when not collapsed to prevent shrinking during text editing
        ...(!isCollapsed && { minHeight: "200px" }),
      }}
    >
      {/* Invisible Target Handles for incoming connections */}
      <UniversalHandle position={Position.Top} isConnectable={isConnectable} />
      <UniversalHandle
        position={Position.Right}
        isConnectable={isConnectable}
      />
      <UniversalHandle
        position={Position.Bottom}
        isConnectable={isConnectable}
      />
      <UniversalHandle position={Position.Left} isConnectable={isConnectable} />

      {/* Side Controls */}
      <SideControl
        position={Position.Top}
        isConnectable={isConnectable}
        onAddNode={handleAddNode}
        isCollapsed={isCollapsed}
      />
      <SideControl
        position={Position.Right}
        isConnectable={isConnectable}
        onAddNode={handleAddNode}
        isCollapsed={isCollapsed}
      />
      <SideControl
        position={Position.Bottom}
        isConnectable={isConnectable}
        onAddNode={handleAddNode}
        isCollapsed={isCollapsed}
      />
      <SideControl
        position={Position.Left}
        isConnectable={isConnectable}
        onAddNode={handleAddNode}
        isCollapsed={isCollapsed}
      />
      {/* Delete Button - Only visible when hovering this specific corner area, hidden for root nodes */}
      {!isRoot && (
        <div className="absolute -top-4 -right-4 w-12 h-12 z-[60] flex items-center justify-center group/delete pointer-events-auto">
          <button
            onClick={handleDelete}
            className="p-2 bg-red-500 text-white rounded-full shadow-md opacity-0 group-hover/delete:opacity-100 transition-all duration-200 hover:scale-110"
            title="Delete Node"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Resize Handle - Bottom Right Corner with dedicated hit area */}
      {/* Hidden when collapsed to avoid visual clutter */}
      {!isCollapsed && (
        <div
          ref={resizeHandleRef}
          className="absolute bottom-0 right-0 w-12 h-12 z-[60] cursor-nwse-resize nodrag nopan"
          onMouseDown={handleResizeStart}
          onClick={(e) => e.stopPropagation()}
          title="Resize Node"
        >
          {/* Visual handle - curved corner indicator */}
          <div className="absolute bottom-0 right-0 w-10 h-8 flex items-end justify-end p-2 pointer-events-none">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-neutral-200 dark:text-neutral-800"
            >
              {/* Arc following the rounded corner - 15% shorter, matches border color */}
              <path
                d="M 17.3 3.7 A 16 16 0 0 1 3.7 17.3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className={`drag-handle px-5 py-4 flex items-center justify-between ${
          isCollapsed ? "rounded-b-[2rem]" : ""
        } cursor-grab active:cursor-grabbing relative z-50`}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={16} className="text-neutral-400" />
          {/* Title - Editable */}
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleTitleSubmit();
                } else if (e.key === "Escape") {
                  setIsEditingTitle(false);
                  setTitle(data.label || "New Node");
                }
              }}
              className="bg-neutral-100 dark:bg-neutral-800 font-medium text-neutral-900 dark:text-neutral-100 text-sm rounded-full px-3 py-1 focus:outline-none max-w-[150px] nodrag"
            />
          ) : (
            <div
              className="flex items-center gap-2 cursor-pointer group/title nodrag"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
            >
              <span className="font-medium text-neutral-700 dark:text-neutral-200 text-sm max-w-[150px] truncate select-none">
                {title}
              </span>
              <Pencil
                size={12}
                className="text-neutral-400 opacity-0 group-hover/title:opacity-100 transition-opacity"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="appearance-none text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-full pl-3 pr-8 py-1.5 border-none focus:ring-0 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <option value="gpt-4o">GPT-4o</option>
              <option value="claude-3-5">Claude 3.5</option>
              <option value="gemini-pro">Gemini Pro</option>
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
            />
          </div>

          <button
            onClick={() => setIsStarred(!isStarred)}
            className={`transition-colors rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
              isStarred
                ? "text-yellow-400 fill-yellow-400"
                : "text-neutral-400 hover:text-yellow-400"
            }`}
          >
            <Flag size={16} fill={isStarred ? "currentColor" : "none"} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-all duration-200 rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:scale-110 relative z-[70]"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* Content Area with Collapse Animation */}
      <div
        className={`flex flex-col flex-1 min-h-0 overflow-hidden transition-all duration-300 ease-in-out nodrag ${
          isCollapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"
        }`}
      >
        {messages.length > 0 && (
          <div
            className={`p-5 nodrag ${
              nodeHeight ? "flex-1 overflow-y-auto min-h-0" : ""
            } custom-scrollbar`}
          >
            {messages.map((msg, idx) => (
              <ChatMessage key={idx} role={msg.role} content={msg.content} />
            ))}
          </div>
        )}

        {!hasSent && (
          <div className="p-5 relative mt-auto flex-shrink-0 nodrag">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="w-full bg-neutral-50 dark:bg-neutral-800/50 rounded-[1.5rem] px-4 py-3 pr-12 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-700 nodrag"
              placeholder="Ask anything..."
              rows={1}
              style={{ minHeight: "48px" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={`absolute right-7 bottom-[33px] p-2 rounded-full transition-all duration-200 flex items-center justify-center ${
                input.trim()
                  ? "bg-neutral-900 dark:bg-white text-white dark:text-black hover:scale-105"
                  : "bg-neutral-200 dark:bg-neutral-700 text-neutral-400 cursor-not-allowed opacity-50"
              }`}
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
