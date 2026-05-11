import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { SettingsConfiguratorArtifact } from './SettingsConfiguratorArtifact';
import { settingsFixture } from '@/app/(dev)/artifacts/fixtures';

describe('SettingsConfiguratorArtifact', () => {
  it('renders the default payload without fetching', () => {
    const html = renderToStaticMarkup(<SettingsConfiguratorArtifact payload={settingsFixture} />);
    expect(html).toMatchSnapshot();
  });

  it('always shows the synergic LCD note', () => {
    const html = renderToStaticMarkup(<SettingsConfiguratorArtifact payload={settingsFixture} />);
    expect(html).toContain('LCD (p. 20)');
  });

  it('omits the numerical block when payload has no wfs/voltage', () => {
    const html = renderToStaticMarkup(<SettingsConfiguratorArtifact payload={settingsFixture} />);
    expect(html).not.toContain('WFS ');
    expect(html).not.toContain('Owner-manual numerical values');
  });

  it('renders the numerical block when payload has wfs/voltage', () => {
    const html = renderToStaticMarkup(
      <SettingsConfiguratorArtifact
        payload={{ ...settingsFixture, wfs_ipm: 250, voltage: 18.5 }}
      />,
    );
    expect(html).toContain('Owner-manual numerical values');
    expect(html).toContain('WFS 250 ipm');
  });
});
