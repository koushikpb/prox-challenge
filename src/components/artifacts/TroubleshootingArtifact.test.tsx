import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { TroubleshootingArtifact } from './TroubleshootingArtifact';
import { troubleshootFixture } from '@/app/(dev)/artifacts/fixtures';

describe('TroubleshootingArtifact', () => {
  it('renders at the first node with question + options', () => {
    const html = renderToStaticMarkup(<TroubleshootingArtifact payload={troubleshootFixture} />);
    expect(html).toMatchSnapshot();
  });

  it('shows the symptom in the header', () => {
    const html = renderToStaticMarkup(<TroubleshootingArtifact payload={troubleshootFixture} />);
    expect(html).toContain('Porosity in welds');
  });

  it('renders a placeholder when the tree is empty', () => {
    const html = renderToStaticMarkup(
      <TroubleshootingArtifact payload={{ type: 'troubleshoot', symptom: 'none', tree: [] }} />,
    );
    expect(html).toContain('No troubleshooting steps');
  });
});
