'use client';

import { CableIcon } from 'lucide-react';

import type {
  GeneratedDiagramArtifactPayload,
  GeneratedDiagramEdge,
  GeneratedDiagramEdgeColor,
  GeneratedDiagramNode,
  ManualSource,
} from '@/streaming';

import { ArtifactCard } from './ArtifactCard';

type Props = {
  payload: GeneratedDiagramArtifactPayload;
  onOpenPage?: (page: number, source: ManualSource) => void;
};

const VIEW_W = 800;
const VIEW_H = 600;

const COLOR_MAP: Record<GeneratedDiagramEdgeColor, string> = {
  red: '#ef4444',
  black: '#27272a',
  green: '#16a34a',
  blue: '#2563eb',
};

const PROCESS_LABEL: Record<GeneratedDiagramArtifactPayload['process'], string> = {
  flux_cored_mig: 'Flux-cored MIG wiring',
  solid_wire_mig: 'Solid-core MIG wiring',
  stick_dcep: 'Stick (DCEP) wiring',
  stick_dcen: 'Stick (DCEN) wiring',
  tig_dcen: 'TIG wiring',
};

const POLARITY_NAME: Record<GeneratedDiagramArtifactPayload['process'], 'DCEP' | 'DCEN'> = {
  flux_cored_mig: 'DCEN',
  solid_wire_mig: 'DCEP',
  stick_dcep: 'DCEP',
  stick_dcen: 'DCEN',
  tig_dcen: 'DCEN',
};

const NODE_SIZE: Record<GeneratedDiagramNode['kind'], { w: number; h: number }> = {
  welder: { w: 180, h: 130 },
  electrode_holder: { w: 150, h: 60 },
  workpiece: { w: 220, h: 50 },
  ground_clamp: { w: 130, h: 40 },
  terminal: { w: 30, h: 30 },
  cable_junction: { w: 16, h: 16 },
};

function NodeShape({ node }: { node: GeneratedDiagramNode }) {
  const size = NODE_SIZE[node.kind];
  const halfW = size.w / 2;
  const halfH = size.h / 2;
  const isTerminal = node.kind === 'terminal' || node.kind === 'cable_junction';
  const fill =
    node.kind === 'welder'
      ? '#fafafa'
      : node.kind === 'workpiece'
        ? '#d4d4d8'
        : node.kind === 'ground_clamp'
          ? '#a3e635'
          : node.kind === 'electrode_holder'
            ? '#fde68a'
            : '#27272a';
  const stroke = node.kind === 'welder' ? '#3f3f46' : '#18181b';
  const textColor = node.kind === 'terminal' || node.kind === 'cable_junction' ? '#fafafa' : '#18181b';

  if (isTerminal) {
    return (
      <g data-slot="diagram-node" data-kind={node.kind} data-node-id={node.id}>
        <circle
          cx={node.x}
          cy={node.y}
          r={size.w / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={2}
        />
        <text
          x={node.x}
          y={node.y + 5}
          textAnchor="middle"
          fontSize={node.kind === 'terminal' ? 18 : 12}
          fontWeight={700}
          fill={textColor}
        >
          {node.label}
        </text>
      </g>
    );
  }

  return (
    <g data-slot="diagram-node" data-kind={node.kind} data-node-id={node.id}>
      <rect
        x={node.x - halfW}
        y={node.y - halfH}
        width={size.w}
        height={size.h}
        rx={node.kind === 'welder' ? 14 : 8}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
      />
      <text
        x={node.x}
        y={node.y + 5}
        textAnchor="middle"
        fontSize={node.kind === 'welder' ? 14 : 13}
        fontWeight={600}
        fill={textColor}
      >
        {node.label}
      </text>
    </g>
  );
}

function Edge({
  edge,
  nodesById,
}: {
  edge: GeneratedDiagramEdge;
  nodesById: Map<string, GeneratedDiagramNode>;
}) {
  const from = nodesById.get(edge.from);
  const to = nodesById.get(edge.to);
  if (!from || !to) return null;
  const color = COLOR_MAP[edge.color];
  const dash = edge.style === 'dashed' ? '8 6' : undefined;
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  return (
    <g data-slot="diagram-edge" className="group/edge">
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={color}
        strokeWidth={4}
        strokeDasharray={dash}
        strokeLinecap="round"
        className="transition-[stroke-width] duration-150 group-hover/edge:[stroke-width:7]"
      />
      {edge.label && (
        <g>
          <rect
            x={midX - edge.label.length * 3.5 - 8}
            y={midY - 11}
            width={edge.label.length * 7 + 16}
            height={22}
            rx={11}
            fill="#fafafa"
            stroke={color}
            strokeWidth={1}
          />
          <text
            x={midX}
            y={midY + 4}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="#27272a"
          >
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
}

function safetyNote(process: GeneratedDiagramArtifactPayload['process']): string {
  // Every wiring diagram drives cables into the welder's output sockets;
  // the canonical lead from system-prompt §Safety nudges applies.
  if (process === 'tig_dcen') {
    return 'Unplug the welder before connecting the torch and work cables.';
  }
  return 'Unplug the welder before changing cable polarity.';
}

export function GeneratedDiagramArtifact({ payload, onOpenPage }: Props) {
  const processLabel = PROCESS_LABEL[payload.process];
  const polarity = POLARITY_NAME[payload.process];
  const subtitle = `Generated layout · ${polarity}`;
  const note = safetyNote(payload.process);
  const nodesById = new Map(payload.nodes.map((n) => [n.id, n]));

  const hero = (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={`${processLabel} diagram (${polarity})`}
      className="block w-full h-auto max-h-72"
      data-slot="diagram-svg"
    >
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#f4f4f5" />
      {payload.edges.map((edge, i) => (
        <Edge key={`e-${i}`} edge={edge} nodesById={nodesById} />
      ))}
      {payload.nodes.map((node) => (
        <NodeShape key={node.id} node={node} />
      ))}
    </svg>
  );

  return (
    <ArtifactCard
      type="generated_diagram"
      tagLabel="GENERATED DIAGRAM"
      tagIcon={CableIcon}
      pageBadge={payload.page_cite ? `page ${payload.page_cite}` : undefined}
      heroSlot={hero}
      title={processLabel}
      subtitle={subtitle}
      safetyNote={note}
      footer={{
        source: 'owner-manual',
        page: payload.page_cite ?? 1,
        onOpenPage: payload.page_cite ? onOpenPage : undefined,
      }}
    >
      <p className="mt-3 text-xs leading-relaxed text-zinc-400" data-slot="diagram-caption">
        {payload.caption}
      </p>
    </ArtifactCard>
  );
}
