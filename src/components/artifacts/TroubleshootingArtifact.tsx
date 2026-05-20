'use client';

import { useMemo, useState } from 'react';
import { WrenchIcon } from 'lucide-react';

import type { ManualSource, TroubleshootArtifactPayload, TroubleshootNode } from '@/streaming';
import { cn } from '@/lib/utils';

import { ArtifactCard } from './ArtifactCard';

type TroubleshootingArtifactProps = {
  payload: TroubleshootArtifactPayload;
  onOpenPage?: (page: number, source: ManualSource) => void;
};

export function TroubleshootingArtifact({
  payload,
  onOpenPage,
}: TroubleshootingArtifactProps) {
  const nodesById = useMemo(() => buildIndex(payload.tree), [payload.tree]);
  const firstId = payload.tree[0]?.node_id;
  const [stack, setStack] = useState<string[]>(firstId ? [firstId] : []);

  if (!firstId) {
    return (
      <ArtifactCard
        type="troubleshoot"
        tagLabel="Troubleshooting"
        tagIcon={WrenchIcon}
        title="Troubleshooting"
        subtitle={payload.symptom}
        footer={{ source: 'owner-manual', page: 37, onOpenPage }}
      >
        <p className="mt-2 text-xs text-zinc-500">No troubleshooting steps provided.</p>
      </ArtifactCard>
    );
  }

  const currentId = stack[stack.length - 1] ?? firstId;
  const node = nodesById.get(currentId) ?? null;
  const isLeaf = node !== null && (node.cause !== undefined || (node.fixes !== undefined && node.fixes.length > 0));
  const canGoBack = stack.length > 1;
  const stepIndex = stack.length;
  const primaryPage = node?.source_pages?.[0] ?? 37;

  return (
    <ArtifactCard
      type="troubleshoot"
      tagLabel="Troubleshooting"
      tagIcon={WrenchIcon}
      pageBadge={`step ${stepIndex}`}
      title={payload.symptom}
      subtitle="Walk through the most likely cause"
      footer={{ source: 'owner-manual', page: primaryPage, onOpenPage }}
    >
      {node ? (
        <div className="mt-3 space-y-3">
          {node.cause && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-100">
              <div className="text-[0.6rem] uppercase tracking-[0.16em] text-amber-300/80">
                Likely cause
              </div>
              <p className="mt-1 leading-relaxed">{node.cause}</p>
            </div>
          )}

          {node.fixes && node.fixes.length > 0 && (
            <div>
              <div className="text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500">Fixes</div>
              <ol className="mt-2 space-y-2">
                {node.fixes.map((fix, i) => (
                  <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-zinc-200">
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] font-mono text-[0.65rem] text-zinc-300">
                      {i + 1}
                    </span>
                    <span>{fix}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {node.question && (
            <div className="space-y-2 text-xs">
              <p className="text-zinc-200">{node.question}</p>
              {node.options && node.options.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {node.options.map((opt) => (
                    <button
                      key={`${opt.next}-${opt.label}`}
                      type="button"
                      onClick={() => setStack((prev) => [...prev, opt.next])}
                      disabled={!nodesById.has(opt.next)}
                      className={cn(
                        'rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-zinc-200 transition-colors',
                        'hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-40',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">
          Step <code className="rounded bg-white/[0.06] px-1">{currentId}</code> is not in the
          provided tree.
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 text-[0.7rem]">
        <button
          type="button"
          onClick={() => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))}
          disabled={!canGoBack}
          className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-zinc-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-30"
        >
          ← Back
        </button>
        {isLeaf && (
          <button
            type="button"
            onClick={() => setStack(firstId ? [firstId] : [])}
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
          >
            Start over
          </button>
        )}
      </div>
    </ArtifactCard>
  );
}

function buildIndex(tree: TroubleshootNode[]): Map<string, TroubleshootNode> {
  const map = new Map<string, TroubleshootNode>();
  for (const node of tree) map.set(node.node_id, node);
  return map;
}
