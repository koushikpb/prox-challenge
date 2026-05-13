'use client';

import type { ArtifactPayload, ManualSource } from '@/streaming';

import { DutyCycleArtifact } from './DutyCycleArtifact';
import { PolarityArtifact } from './PolarityArtifact';
import { SettingsConfiguratorArtifact } from './SettingsConfiguratorArtifact';
import { TroubleshootingArtifact } from './TroubleshootingArtifact';

export { DutyCycleArtifact, PolarityArtifact, SettingsConfiguratorArtifact, TroubleshootingArtifact };
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
} as const satisfies {
  [K in ArtifactPayload['type']]: RegistryComponent<Extract<ArtifactPayload, { type: K }>>;
};

export function RenderArtifact({
  payload,
  onOpenPage,
}: {
  payload: ArtifactPayload;
  onOpenPage?: OpenPage;
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
  }
}
