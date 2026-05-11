'use client';

import {
  DutyCycleArtifact,
  PolarityArtifact,
  SettingsConfiguratorArtifact,
  TroubleshootingArtifact,
} from '@/components/artifacts';

import {
  dutyCycleFixture,
  polarityFixture,
  settingsFixture,
  troubleshootFixture,
} from './fixtures';

export default function ArtifactsShowcasePage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="font-heading text-lg font-semibold">Artifact showcase (dev)</h1>
        <p className="text-xs text-muted-foreground">
          Each component rendered with a fixture payload. Adjust controls to validate interactive
          paths.
        </p>
      </header>

      <ShowcaseSection title="DutyCycleArtifact">
        <DutyCycleArtifact payload={dutyCycleFixture} />
      </ShowcaseSection>

      <ShowcaseSection title="PolarityArtifact">
        <PolarityArtifact payload={polarityFixture} />
      </ShowcaseSection>

      <ShowcaseSection title="SettingsConfiguratorArtifact">
        <SettingsConfiguratorArtifact payload={settingsFixture} />
      </ShowcaseSection>

      <ShowcaseSection title="TroubleshootingArtifact">
        <TroubleshootingArtifact payload={troubleshootFixture} />
      </ShowcaseSection>
    </main>
  );
}

function ShowcaseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}
