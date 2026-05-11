'use client';

import { useMemo, useState } from 'react';

import type { TroubleshootArtifactPayload, TroubleshootNode } from '@/streaming';
import { cn } from '@/lib/utils';

type TroubleshootingArtifactProps = { payload: TroubleshootArtifactPayload };

export function TroubleshootingArtifact({ payload }: TroubleshootingArtifactProps) {
  const nodesById = useMemo(() => buildIndex(payload.tree), [payload.tree]);
  const firstId = payload.tree[0]?.node_id;
  const [stack, setStack] = useState<string[]>(firstId ? [firstId] : []);

  if (!firstId) {
    return (
      <section className="rounded-lg border bg-card p-3 text-card-foreground" data-slot="artifact" data-artifact-type="troubleshoot">
        <h3 className="font-heading text-sm font-semibold">Troubleshooting</h3>
        <p className="text-xs text-muted-foreground">No troubleshooting steps provided.</p>
      </section>
    );
  }

  const currentId = stack[stack.length - 1] ?? firstId;
  const node = nodesById.get(currentId) ?? null;
  const isLeaf = node !== null && (node.cause !== undefined || (node.fixes !== undefined && node.fixes.length > 0));
  const canGoBack = stack.length > 1;

  return (
    <section
      className="space-y-3 rounded-lg border bg-card p-3 text-card-foreground shadow-sm"
      data-slot="artifact"
      data-artifact-type="troubleshoot"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold">Troubleshooting wizard</h3>
        <span className="text-xs text-muted-foreground">{payload.symptom}</span>
      </header>

      {node ? (
        <div className="space-y-2">
          {node.cause && (
            <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="text-[0.65rem] uppercase tracking-wide opacity-70">Likely cause</div>
              <div>{node.cause}</div>
            </div>
          )}

          {node.fixes && node.fixes.length > 0 && (
            <div className="space-y-1 text-xs">
              <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Fixes</div>
              <ul className="ml-3 list-disc space-y-0.5">
                {node.fixes.map((fix, i) => (
                  <li key={i}>{fix}</li>
                ))}
              </ul>
            </div>
          )}

          {node.question && (
            <div className="space-y-1.5 text-xs">
              <div className="text-foreground">{node.question}</div>
              {node.options && node.options.length > 0 && (
                <div className="flex flex-col gap-1">
                  {node.options.map((opt) => (
                    <button
                      key={`${opt.next}-${opt.label}`}
                      type="button"
                      onClick={() => setStack((prev) => [...prev, opt.next])}
                      disabled={!nodesById.has(opt.next)}
                      className={cn(
                        'rounded-md border bg-background px-2 py-1 text-left text-xs transition-colors',
                        'hover:bg-muted disabled:opacity-50',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <SourcePages pages={node.source_pages} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Step <code>{currentId}</code> is not in the provided tree.
        </p>
      )}

      <div className="flex items-center justify-between text-[0.7rem]">
        <button
          type="button"
          onClick={() => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))}
          disabled={!canGoBack}
          className="rounded-md border bg-background px-2 py-0.5 transition-colors hover:bg-muted disabled:opacity-40"
        >
          ← Back
        </button>
        {isLeaf && (
          <button
            type="button"
            onClick={() => setStack(firstId ? [firstId] : [])}
            className="rounded-md border bg-background px-2 py-0.5 transition-colors hover:bg-muted"
          >
            Start over
          </button>
        )}
      </div>
    </section>
  );
}

function SourcePages({ pages }: { pages: number[] }) {
  if (!pages || pages.length === 0) return null;
  return (
    <div className="text-[0.7rem] text-muted-foreground">
      Source: {pages.map((p) => `p. ${p}`).join(', ')}
    </div>
  );
}

function buildIndex(tree: TroubleshootNode[]): Map<string, TroubleshootNode> {
  const map = new Map<string, TroubleshootNode>();
  for (const node of tree) map.set(node.node_id, node);
  return map;
}
