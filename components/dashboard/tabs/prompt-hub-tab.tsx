import { useState } from "react";

type PromptHubTabProps = {
  customPrompts: string[];
  brandName?: string;
  busy: boolean;
  activeProviderCount: number;
  onAddCustomPrompt: (value: string) => void;
  onRemoveCustomPrompt: (value: string) => void;
  onRunPrompt: (prompt: string) => void;
  onBatchRunAll: () => void;
};

export function PromptHubTab({
  customPrompts,
  brandName,
  busy,
  activeProviderCount,
  onAddCustomPrompt,
  onRemoveCustomPrompt,
  onRunPrompt,
  onBatchRunAll,
}: PromptHubTabProps) {
  const [newPrompt, setNewPrompt] = useState("");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);

  const interpolateBrand = (value: string) => {
    if (!brandName?.trim()) return value;
    return value.replaceAll("{brand}", brandName.trim());
  };

  const handleToggleBulkImport = () => {
    if (showBulkImport) {
      setShowBulkImport(false);
      setBulkText("");
      setImportResult(null);
    } else {
      setShowBulkImport(true);
      setBulkText("");
      setImportResult(null);
    }
  };

  const handleBulkImport = () => {
    // 1. Split by newline
    const lines = bulkText.split("\n");

    // 2. Trim each line, filter out empty/whitespace-only lines
    const trimmedLines = lines.map((l) => l.trim()).filter((l) => l.length > 0);

    // 3. Deduplicate within the pasted batch itself (keep first occurrence)
    const seenInBatch = new Set<string>();
    const uniqueLines: string[] = [];
    for (const line of trimmedLines) {
      if (!seenInBatch.has(line)) {
        seenInBatch.add(line);
        uniqueLines.push(line);
      }
    }

    // 4 & 5. Check against existing prompts and call onAddCustomPrompt for new ones
    let added = 0;
    let skipped = 0;

    for (const line of uniqueLines) {
      if (customPrompts.includes(line)) {
        skipped++;
      } else {
        onAddCustomPrompt(line);
        added++;
      }
    }

    // 6. Count skipped also includes within-batch duplicates
    const batchDuplicates = trimmedLines.length - uniqueLines.length;
    skipped += batchDuplicates;

    // 7. Set importResult with the counts
    setImportResult({ added, skipped });

    // 8. Clear bulkText
    setBulkText("");

    // 9 & 10. If at least one was added, close after delay; otherwise keep open
    if (added > 0) {
      setTimeout(() => setShowBulkImport(false), 1500);
    }

    // Auto-clear the result message after 5 seconds
    setTimeout(() => setImportResult(null), 5000);
  };

  const total = importResult ? importResult.added + importResult.skipped : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-th-border bg-th-card-alt p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium uppercase tracking-wider text-th-text-muted">
            Tracking Prompt Library
          </div>
          {customPrompts.length > 0 && (
            <button
              disabled={busy}
              onClick={onBatchRunAll}
              className="bd-btn-primary rounded-lg px-3 py-1.5 text-sm disabled:opacity-60"
              title={`Run all ${customPrompts.length} prompts × ${activeProviderCount} model${activeProviderCount > 1 ? "s" : ""}`}
            >
              ▶ Run All ({customPrompts.length} × {activeProviderCount})
            </button>
          )}
        </div>
        <p className="mb-3 text-sm text-th-text-secondary">
          Add the exact prompts you want to track over time. Use <span className="font-semibold">{"{brand}"}</span> to inject your brand name.
          {activeProviderCount > 1 && (
            <span className="ml-1 text-th-text-accent">· Runs across {activeProviderCount} selected models in parallel.</span>
          )}
        </p>

        <div className="mb-3 flex gap-2">
          <input
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="e.g. Best alternatives to {brand} for B2B SEO analytics"
            className="bd-input w-full rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => {
              onAddCustomPrompt(newPrompt);
              setNewPrompt("");
            }}
            className="bd-btn-primary rounded-lg px-4 py-2 text-sm"
          >
            Add
          </button>
          <button
            onClick={handleToggleBulkImport}
            className="bd-chip rounded-lg px-4 py-2 text-sm"
          >
            {showBulkImport ? "Cancel" : "Bulk Import"}
          </button>
        </div>

        {showBulkImport && (
          <div className="mb-3 space-y-2">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Paste prompts here, one per line..."
              className="bd-input w-full rounded-lg px-3 py-2 text-sm"
              rows={6}
            />
            <button
              onClick={handleBulkImport}
              disabled={bulkText.trim() === ""}
              className="bd-btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60"
            >
              Add All
            </button>
            {importResult !== null && (
              <p className="text-sm text-th-text-accent">
                {importResult.skipped > 0
                  ? `${importResult.added} van ${total} prompts toegevoegd, ${importResult.skipped} duplicaten overgeslagen`
                  : `${importResult.added} prompts toegevoegd`}
              </p>
            )}
          </div>
        )}

        <ul className="max-h-[400px] space-y-2 overflow-auto pr-1 text-sm">
          {customPrompts.length === 0 && (
            <li className="text-th-text-secondary">No custom prompts added yet.</li>
          )}
          {customPrompts.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="rounded-lg border border-th-border bg-th-card p-3"
            >
              <div className="mb-2 line-clamp-3 text-th-text">{interpolateBrand(item)}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => onRunPrompt(interpolateBrand(item))}
                  className="bd-btn-primary rounded-md px-3 py-1.5 text-xs"
                >
                  Run
                </button>
                <button
                  onClick={() => onRemoveCustomPrompt(item)}
                  className="bd-chip rounded-md px-3 py-1.5 text-xs"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
