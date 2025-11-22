import React from 'react';
import { SquarePen, Search } from 'lucide-react';

export default function Sidebar() {
  const canvases = [
    { id: 1, name: 'Brainstorming Session' },
    { id: 2, name: 'Project Architecture' },
    { id: 3, name: 'Marketing Plan' },
  ];

  return (
    <aside className="w-64 h-full bg-neutral-900 border-r border-neutral-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800">
        <h1 className="text-xl font-bold text-neutral-200">bn.ai</h1>
      </div>

      {/* Top Section */}
      <div className="p-3 space-y-0.5">
        {/* New Canvas Button */}
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-base text-neutral-200 hover:bg-neutral-800 transition-colors">
          <SquarePen size={16} className="text-neutral-400" />
          <span>New canvas</span>
        </button>

        {/* Search Button */}
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-base text-neutral-200 hover:bg-neutral-800 transition-colors">
          <Search size={16} className="text-neutral-400" />
          <span>Search canvases</span>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {/* Saved Canvases Section */}
        <div className="px-3 py-2">
          <div className="text-sm text-neutral-500 mb-2 px-0">
            Saved canvases
          </div>
          <ul className="space-y-0.5">
            {canvases.map((canvas) => (
              <li key={canvas.id}>
                <button className="w-full px-0 py-1.5 rounded-lg text-base text-neutral-200 hover:bg-neutral-800 transition-colors text-left">
                  <span className="truncate">{canvas.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

