'use client';

import type { ArtifactPayload } from '@/streaming';

import { DutyCycleArtifact } from './DutyCycleArtifact';
import { PolarityArtifact } from './PolarityArtifact';
import { SettingsConfiguratorArtifact } from './SettingsConfiguratorArtifact';
import { TroubleshootingArtifact } from './TroubleshootingArtifact';

export { DutyCycleArtifact, PolarityArtifact, SettingsConfiguratorArtifact, TroubleshootingArtifact };

type RegistryComponent<P extends ArtifactPayload> = (props: { payload: P }) => React.ReactElement;

export const artifactRegistry = {
  duty_cycle: DutyCycleArtifact,
  polarity: PolarityArtifact,
  settings: SettingsConfiguratorArtifact,
  troubleshoot: TroubleshootingArtifact,
} as const satisfies {
  [K in ArtifactPayload['type']]: RegistryComponent<Extract<ArtifactPayload, { type: K }>>;
};

export function RenderArtifact({ payload }: { payload: ArtifactPayload }) {
  switch (payload.type) {
    case 'duty_cycle':
      return <DutyCycleArtifact payload={payload} />;
    case 'polarity':
      return <PolarityArtifact payload={payload} />;
    case 'settings':
      return <SettingsConfiguratorArtifact payload={payload} />;
    case 'troubleshoot':
      return <TroubleshootingArtifact payload={payload} />;
  }
}
