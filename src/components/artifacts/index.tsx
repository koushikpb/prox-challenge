'use client';

import type { ArtifactPayload, ManualSource } from '@/streaming';

import { DutyCycleArtifact } from './DutyCycleArtifact';
import {
  GeneratedDiagramArtifact,
  type OpenDiagramHandler,
} from './GeneratedDiagramArtifact';
import { PolarityArtifact } from './PolarityArtifact';
import { RegionArtifact } from './RegionArtifact';
import { SettingsConfiguratorArtifact } from './SettingsConfiguratorArtifact';
import { TroubleshootingArtifact } from './TroubleshootingArtifact';

export {
  DutyCycleArtifact,
  GeneratedDiagramArtifact,
  PolarityArtifact,
  RegionArtifact,
  SettingsConfiguratorArtifact,
  TroubleshootingArtifact,
};
export { ArtifactCard, ArtifactRows } from './ArtifactCard';

type OpenPage = (page: number, source: ManualSource) => void;

type RegistryComponent<P extends ArtifactPayload> = (props: {
  payload: P;
  onOpenPage?: OpenPage;
}) => React.ReactElement;

export const artifactRegistry = {
  duty_cycle: DutyCycleArtifact,
  polarity: PolarityArtifact,
  settings: SettingsConfiguratorArtifact,
  troubleshoot: TroubleshootingArtifact,
  region: RegionArtifact,
  generated_diagram: GeneratedDiagramArtifact,
} as const satisfies {
  [K in ArtifactPayload['type']]: RegistryComponent<Extract<ArtifactPayload, { type: K }>>;
};

export function RenderArtifact({
  payload,
  onOpenPage,
  onOpenDiagram,
}: {
  payload: ArtifactPayload;
  onOpenPage?: OpenPage;
  onOpenDiagram?: OpenDiagramHandler;
}) {
  switch (payload.type) {
    case 'duty_cycle':
      return <DutyCycleArtifact payload={payload} onOpenPage={onOpenPage} />;
    case 'polarity':
      return <PolarityArtifact payload={payload} onOpenPage={onOpenPage} />;
    case 'settings':
      return <SettingsConfiguratorArtifact payload={payload} onOpenPage={onOpenPage} />;
    case 'troubleshoot':
      return <TroubleshootingArtifact payload={payload} onOpenPage={onOpenPage} />;
    case 'region':
      return <RegionArtifact payload={payload} onOpenPage={onOpenPage} />;
    case 'generated_diagram':
      return (
        <GeneratedDiagramArtifact
          payload={payload}
          onOpenPage={onOpenPage}
          onOpenDiagram={onOpenDiagram}
        />
      );
  }
}
