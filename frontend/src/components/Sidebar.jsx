import React, { useState, useEffect } from "react";
import {
  SquarePen,
  Search,
  MoreVertical,
  Trash2,
  Pencil,
  PanelLeftClose,
  PanelRightOpen,
} from "lucide-react";

import { boardAPI, nodeAPI } from "../utils/api";
import SearchBoardsModal from "./SearchBoardsModal";

export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  onBoardSwitch,
  currentBoardId,
  colorMode = "dark",
}) {
  const [boards, setBoards] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [editingBoardId, setEditingBoardId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState(null);

  // GET ALL BOARDS //
  const getBoards = async () => {
    try {
      const data = await boardAPI.getBoards();
      console.log("Boards fetched:", data);
      setBoards(data);
    } catch (error) {
      console.error("Error fetching boards:", error);
    }
  };

  // Get boards on mount
  useEffect(() => {
    getBoards();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpenId && !event.target.closest(".menu-container")) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenId]);

  // CREATE NEW BOARD //
  const createBoard = async () => {
    if (!boardName.trim()) return;

    try {
      // 1. Create the board
      const boardData = await boardAPI.createBoard(boardName);
      console.log("Board created:", boardData);
      const newBoardId = boardData.id;

      // 2. Create a root node for the new board
      // Position it at the center of the viewport (you can adjust this)
      const rootNodeData = {
        id: `node-${Date.now()}`,
        board_id: newBoardId,
        x: 100, // Default position - you can center it based on viewport
        y: 100,
        width: 400,
        height: null, // Auto height
        title: "New Chat",
        prompt: null,
        role: "user",
        is_root: true, // IMPORTANT: Mark as root node
        is_collapsed: false,
        is_starred: false,
        model: "gemini-pro",
      };

      const rootNode = await nodeAPI.createNode(newBoardId, rootNodeData);
      console.log("Root node created:", rootNode);

      // 3. Close modal and refresh board list
      setShowModal(false);
      setBoardName("");
      getBoards();

      // 3. Switch to the new board
      if (onBoardSwitch) {
        onBoardSwitch(newBoardId);
      }
    } catch (error) {
      console.error("Error creating board:", error);
    }
  };

  // RENAME BOARD //
  const renameBoard = async (boardId) => {
    if (!editingName.trim()) {
      setEditingBoardId(null);
      return;
    }

    try {
      await boardAPI.updateBoard(boardId, editingName);
      getBoards();
      setEditingBoardId(null);
      setEditingName("");
      setMenuOpenId(null);
    } catch (error) {
      console.error("Error renaming board:", error);
    }
  };

  // DELETE BOARD //
  const deleteBoard = async (boardId) => {
    try {
      await boardAPI.deleteBoard(boardId);
      getBoards();
      setMenuOpenId(null);
      // If we deleted the current board, switch to first available board
      if (boardId === currentBoardId && boards.length > 1) {
        const remainingBoards = boards.filter((b) => b.id !== boardId);
        if (remainingBoards.length > 0 && onBoardSwitch) {
          onBoardSwitch(remainingBoards[0].id);
        }
      }
    } catch (error) {
      console.error("Error deleting board:", error);
    }
  };

  // Handle modal open/close
  const handleNewBoard = () => {
    setBoardName("");
    setShowModal(true);
  };

  // Handle Enter key in input
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      createBoard();
    }
  };

  // Handle Enter key in rename input
  const handleRenameKeyPress = (e, boardId) => {
    if (e.key === "Enter") {
      renameBoard(boardId);
    } else if (e.key === "Escape") {
      setEditingBoardId(null);
      setEditingName("");
      setMenuOpenId(null);
    }
  };

  // Handle board click to switch
  const handleBoardClick = (boardId) => {
    if (onBoardSwitch) {
      onBoardSwitch(boardId);
    }
  };

  // Get current board name for breadcrumbs
  const currentBoard = boards.find((b) => b.id === currentBoardId);

  // COLLAPSED VIEW
  if (isCollapsed) {
    return (
      <aside className="group/sidebar w-16 h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col transition-all duration-200">
        {/* Logo / Expand Button */}
        <div className="relative p-4 flex items-center justify-center">
          {/* Logo - Hidden on hover */}
          <img
            src="/weaverw.svg"
            alt="weaver logo"
            className="w-6 h-6 brightness-0 dark:brightness-0 dark:invert opacity-100 group-hover/sidebar:opacity-0 transition-opacity duration-200"
          />
          {/* Expand Button - Shown on hover */}
          <button
            onClick={onToggleCollapse}
            className="absolute flex items-center justify-center w-6 h-6 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200"
            title="Expand sidebar"
          >
            <PanelRightOpen size={16} />
          </button>
        </div>

        {/* Top Section - Icon Only */}
        <div className="px-3 space-y-0.5">
          {/* New Board Button */}
          <button
            onClick={handleNewBoard}
            className="w-full flex items-center justify-center p-2 rounded-lg text-neutral-900 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="New board"
          >
            <SquarePen
              size={16}
              className="text-neutral-500 dark:text-neutral-400"
            />
          </button>

          {/* Search Button */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-neutral-900 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Search boards"
          >
            <Search
              size={16}
              className="text-neutral-500 dark:text-neutral-400"
            />
          </button>
        </div>
      </aside>
    );
  }

  // EXPANDED VIEW
  return (
    <>
      <aside className="w-64 h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col transition-all duration-200">
        {/* Logo and Collapse Button */}
        <div className="relative p-4">
          <img
            src="/weaverw.svg"
            alt="weaver logo"
            className="w-6 h-6 brightness-0 dark:brightness-0 dark:invert"
          />
          {/* Collapse Button - Top Right */}
          <button
            onClick={onToggleCollapse}
            className="absolute top-4 right-4 p-1.5 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* Top Section */}
        <div className="space-y-0.5">
          {/* New Board Button */}
          <button
            onClick={handleNewBoard}
            className="w-full flex items-center gap-2 py-2 px-4 rounded-lg text-base text-neutral-900 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <SquarePen
              size={16}
              className="text-neutral-500 dark:text-neutral-400"
            />
            <span>New board</span>
          </button>

          {/* Search Button */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="w-full flex items-center gap-2 py-2 px-4 rounded-lg text-base text-neutral-900 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <Search
              size={16}
              className="text-neutral-500 dark:text-neutral-400"
            />
            <span>Search boards</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Saved Boards Section */}
          <div className="py-2">
            <div className="text-sm text-neutral-500 dark:text-neutral-500 mb-2 px-4">
              Saved boards
            </div>
            <ul className="space-y-0.5">
              {boards.map((board) => (
                <li
                  key={board.id}
                  className={`group relative ${
                    menuOpenId === board.id ? "z-[100]" : "z-0"
                  }`}
                >
                  {editingBoardId === board.id ? (
                    // Edit mode
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => handleRenameKeyPress(e, board.id)}
                        onBlur={() => renameBoard(board.id)}
                        autoFocus
                        className="flex-1 py-1.5 px-4 rounded-lg text-base text-neutral-900 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
                      />
                    </div>
                  ) : (
                    // Normal mode
                    <div className="relative group/item">
                      <button
                        onClick={() => handleBoardClick(board.id)}
                        className={`w-full py-1.5 px-4 rounded-lg text-base text-left transition-colors ${
                          currentBoardId === board.id
                            ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-200 font-medium"
                            : "text-neutral-900 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        }`}
                        title={board.name}
                      >
                        <span className="truncate block">{board.name}</span>
                      </button>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 menu-container">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(
                              menuOpenId === board.id ? null : board.id
                            );
                          }}
                          className="opacity-0 group-hover/item:opacity-100 p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
                          title="More options"
                        >
                          <MoreVertical
                            size={14}
                            className="text-neutral-500 dark:text-neutral-400"
                          />
                        </button>
                        {menuOpenId === board.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-[100] min-w-[120px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingBoardId(board.id);
                                setEditingName(board.name);
                                setMenuOpenId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                            >
                              <Pencil size={14} />
                              <span>Rename</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteBoard(board.id);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 size={14} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* Search Boards Modal */}
      <SearchBoardsModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onBoardSwitch={onBoardSwitch}
        onCreateBoard={handleNewBoard}
        currentBoardId={currentBoardId}
        colorMode={colorMode}
      />

      {/* Create Board Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-neutral-900 rounded-[2rem] p-6 w-96 border border-neutral-200 dark:border-neutral-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-200 mb-4">
              Create New Board
            </h2>

            <input
              type="text"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter board name..."
              autoFocus
              className="w-full px-4 py-3 mb-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-[1.5rem] text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-700 transition-all"
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={createBoard}
                className="px-4 py-2 bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 rounded-full text-white dark:text-neutral-900 font-medium transition-all duration-200 hover:scale-105"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
