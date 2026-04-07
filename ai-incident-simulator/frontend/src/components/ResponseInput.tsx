"use client";

import { useState } from "react";

interface ResponseInputProps {
  availableActions: string[];
  onSubmit: (selectedActions: string[], freeText: string) => void;
  isLoading: boolean;
}

export function ResponseInput({ availableActions, onSubmit, isLoading }: ResponseInputProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [freeText, setFreeText] = useState("");

  function toggle(action: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(action) ? next.delete(action) : next.add(action);
      return next;
    });
  }

  function handleSubmit() {
    if (selected.size === 0) return;
    onSubmit(Array.from(selected), freeText);
    setSelected(new Set());
    setFreeText("");
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-300">Select your response actions:</h3>

      <div className="space-y-2">
        {availableActions.map((action) => {
          const isSelected = selected.has(action);
          return (
            <label
              key={action}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                isSelected
                  ? "border-blue-600 bg-blue-950/50"
                  : "border-[var(--card-border)] bg-[var(--card)] hover:border-slate-600"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(action)}
                className="mt-0.5 accent-blue-500"
              />
              <span className="text-sm text-slate-300 leading-snug">{action}</span>
            </label>
          );
        })}
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">
          Additional actions or reasoning (optional):
        </label>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Describe any additional steps you would take..."
          rows={3}
          className="w-full bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-600 resize-none"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={selected.size === 0 || isLoading}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {isLoading ? "Analyzing response..." : `Submit Response (${selected.size} action${selected.size !== 1 ? "s" : ""} selected)`}
      </button>
    </div>
  );
}
