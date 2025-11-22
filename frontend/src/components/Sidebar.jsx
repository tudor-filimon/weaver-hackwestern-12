import React, { useState, useEffect } from "react";
import {
  SquarePen,
  Search,
  X,
  Trash2,
  PanelLeftClose,
  PanelRightOpen,
} from "lucide-react";

export default function Sidebar({ isCollapsed, onToggleCollapse }) {
  const [boards, setBoards] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [boardName, setBoardName] = useState("");

  // GET ALL BOARDS //
  const getBoards = async () => {
    try {
      const response = await fetch("http://0.0.0.0:8000/api/boards/");
      const data = await response.json();
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

  // CREATE NEW BOARD //
  const createBoard = async () => {
    if (!boardName.trim()) return;

    try {
      const response = await fetch("http://0.0.0.0:8000/api/boards/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: boardName }),
      });
      const data = await response.json();
      console.log("Board created:", data);

      setShowModal(false);
      setBoardName("");
      getBoards();
    } catch (error) {
      console.error("Error creating board:", error);
    }
  };

  // DELETE BOARD //
  const deleteBoard = async (boardId) => {
    try {
      const response = await fetch(
        `http://0.0.0.0:8000/api/boards/${boardId}/`,
        {
          method: "DELETE",
        }
      );
      const data = await response.json();
      console.log("Board deleted:", data);
      getBoards();
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

  // COLLAPSED VIEW
  if (isCollapsed) {
    return (
      <aside className="group/sidebar w-16 h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col transition-all duration-200">
        {/* Logo / Expand Button */}
        <div className="relative p-4 flex items-center justify-center">
          {/* Logo - Hidden on hover */}
          <img
            src="/bnlogo.svg"
            alt="bn.ai logo"
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
            src="/bnlogo.svg"
            alt="bn.ai logo"
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
        <div className="px-4 space-y-0.5">
          {/* New Board Button */}
          <button
            onClick={handleNewBoard}
            className="w-full flex items-center gap-2 py-2 rounded-lg text-base text-neutral-900 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <SquarePen
              size={16}
              className="text-neutral-500 dark:text-neutral-400"
            />
            <span>New board</span>
          </button>

          {/* Search Button */}
          <button className="w-full flex items-center gap-2 py-2 rounded-lg text-base text-neutral-900 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <Search
              size={16}
              className="text-neutral-500 dark:text-neutral-400"
            />
            <span>Search boards</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-2">
          {/* Saved Boards Section */}
          <div className="px-4 py-2">
            <div className="text-sm text-neutral-500 dark:text-neutral-500 mb-2">
              Saved boards
            </div>
            <ul className="space-y-0.5">
              {boards.map((board) => (
                <li key={board.id} className="group flex items-center gap-2">
                  <button
                    className="flex-1 py-1.5 px-2 rounded-lg text-base text-neutral-900 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
                    title={board.name}
                  >
                    <span className="truncate block">{board.name}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBoard(board.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-all"
                    title="Delete board"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* Create Board Modal */}
      {showModal && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-neutral-800 rounded-lg p-6 w-96 border border-neutral-700 shadow-xl">
          <h2 className="text-lg font-semibold text-neutral-200 mb-4">
            Create New Board
          </h2>

          <input
            type="text"
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Enter board name..."
            autoFocus
            className="w-full px-3 py-2 mb-4 bg-neutral-700 border border-neutral-600 rounded-lg text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-lg text-neutral-300 hover:bg-neutral-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createBoard}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </>
  );
}
