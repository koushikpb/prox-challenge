import type {
  GeneratedDiagramEdge,
  GeneratedDiagramNode,
  WiringProcess,
} from '@/streaming';

export type WiringLayout = {
  nodes: GeneratedDiagramNode[];
  edges: GeneratedDiagramEdge[];
  caption: string;
  page_cite: number;
  polarity_name: 'DCEP' | 'DCEN';
  electrode_terminal: 'Positive' | 'Negative';
  ground_terminal: 'Positive' | 'Negative';
};

// Shared canvas anchors. Hand-tuned to read cleanly at the 800×600 viewbox.
// The welder body sits upper-left with two output terminals on its face;
// the electrode tool sits upper-right; the workpiece + ground clamp sit
// lower-right. Cables route in straight diagonal segments — no junctions
// needed for these single-loop circuits, which keeps the diagram legible.
const ANCHORS = {
  welder: { x: 160, y: 180, label: 'OmniPro 220' } as const,
  pos_terminal: { x: 220, y: 280 } as const,
  neg_terminal: { x: 140, y: 280 } as const,
  workpiece: { x: 540, y: 480 } as const,
  ground_clamp: { x: 620, y: 460 } as const,
};

function commonNodes(electrodeLabel: string, electrodeKind: 'electrode_holder'): GeneratedDiagramNode[] {
  return [
    { id: 'welder', label: ANCHORS.welder.label, kind: 'welder', x: ANCHORS.welder.x, y: ANCHORS.welder.y },
    { id: 'pos_terminal', label: '+', kind: 'terminal', x: ANCHORS.pos_terminal.x, y: ANCHORS.pos_terminal.y },
    { id: 'neg_terminal', label: '−', kind: 'terminal', x: ANCHORS.neg_terminal.x, y: ANCHORS.neg_terminal.y },
    { id: 'electrode', label: electrodeLabel, kind: electrodeKind, x: 620, y: 200 },
    { id: 'workpiece', label: 'Workpiece', kind: 'workpiece', x: ANCHORS.workpiece.x, y: ANCHORS.workpiece.y },
    { id: 'ground_clamp', label: 'Ground clamp', kind: 'ground_clamp', x: ANCHORS.ground_clamp.x, y: ANCHORS.ground_clamp.y },
  ];
}

function buildEdges({
  electrode_terminal,
  ground_terminal,
  electrode_label,
}: {
  electrode_terminal: 'Positive' | 'Negative';
  ground_terminal: 'Positive' | 'Negative';
  electrode_label: string;
}): GeneratedDiagramEdge[] {
  const electrodeFrom = electrode_terminal === 'Positive' ? 'pos_terminal' : 'neg_terminal';
  const groundFrom = ground_terminal === 'Positive' ? 'pos_terminal' : 'neg_terminal';
  return [
    {
      from: electrodeFrom,
      to: 'electrode',
      label: electrode_label,
      polarity: electrode_terminal === 'Positive' ? '+' : '-',
      color: electrode_terminal === 'Positive' ? 'red' : 'black',
      style: 'solid',
    },
    {
      from: groundFrom,
      to: 'ground_clamp',
      label: 'work-return cable',
      polarity: ground_terminal === 'Positive' ? '+' : '-',
      color: ground_terminal === 'Positive' ? 'red' : 'black',
      style: 'solid',
    },
    {
      from: 'ground_clamp',
      to: 'workpiece',
      polarity: 'ground',
      color: 'green',
      style: 'dashed',
    },
  ];
}

export const WIRING_DIAGRAMS: Record<WiringProcess, WiringLayout> = {
  solid_wire_mig: {
    polarity_name: 'DCEP',
    electrode_terminal: 'Positive',
    ground_terminal: 'Negative',
    page_cite: 14,
    caption:
      'Solid-core MIG (gas-shielded) wiring — DCEP: wire-feed cable to Positive (+), work return to Negative (−).',
    nodes: commonNodes('MIG gun', 'electrode_holder'),
    edges: buildEdges({
      electrode_terminal: 'Positive',
      ground_terminal: 'Negative',
      electrode_label: 'wire-feed cable',
    }),
  },

  flux_cored_mig: {
    polarity_name: 'DCEN',
    electrode_terminal: 'Negative',
    ground_terminal: 'Positive',
    page_cite: 13,
    caption:
      'Flux-cored MIG (gasless) wiring — DCEN: wire-feed cable to Negative (−), work return to Positive (+). Reverse of solid-core.',
    nodes: commonNodes('MIG gun', 'electrode_holder'),
    edges: buildEdges({
      electrode_terminal: 'Negative',
      ground_terminal: 'Positive',
      electrode_label: 'wire-feed cable',
    }),
  },

  stick_dcep: {
    polarity_name: 'DCEP',
    electrode_terminal: 'Positive',
    ground_terminal: 'Negative',
    page_cite: 27,
    caption:
      'Stick (SMAW) wiring — DCEP: electrode holder to Positive (+), work return to Negative (−). The manual default for most rods.',
    nodes: commonNodes('Electrode holder', 'electrode_holder'),
    edges: buildEdges({
      electrode_terminal: 'Positive',
      ground_terminal: 'Negative',
      electrode_label: 'electrode cable',
    }),
  },

  stick_dcen: {
    polarity_name: 'DCEN',
    electrode_terminal: 'Negative',
    ground_terminal: 'Positive',
    page_cite: 27,
    caption:
      'Stick (SMAW) wiring — DCEN: electrode holder to Negative (−), work return to Positive (+). Use only when the electrode manufacturer calls for reversed polarity.',
    nodes: commonNodes('Electrode holder', 'electrode_holder'),
    edges: buildEdges({
      electrode_terminal: 'Negative',
      ground_terminal: 'Positive',
      electrode_label: 'electrode cable',
    }),
  },

  tig_dcen: {
    polarity_name: 'DCEN',
    electrode_terminal: 'Negative',
    ground_terminal: 'Positive',
    page_cite: 24,
    caption:
      'TIG wiring — DCEN: torch cable to Negative (−), work return to Positive (+). Standard polarity for TIG on steel.',
    nodes: commonNodes('TIG torch', 'electrode_holder'),
    edges: buildEdges({
      electrode_terminal: 'Negative',
      ground_terminal: 'Positive',
      electrode_label: 'torch cable',
    }),
  },
};

export function humanizeProcess(process: WiringProcess): string {
  switch (process) {
    case 'flux_cored_mig':
      return 'Flux-cored MIG wiring';
    case 'solid_wire_mig':
      return 'Solid-core MIG wiring';
    case 'stick_dcep':
      return 'Stick (DCEP) wiring';
    case 'stick_dcen':
      return 'Stick (DCEN) wiring';
    case 'tig_dcen':
      return 'TIG wiring';
  }
}
