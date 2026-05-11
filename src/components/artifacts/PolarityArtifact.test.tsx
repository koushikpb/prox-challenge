import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { PolarityArtifact } from './PolarityArtifact';
import { polarityFixture } from '@/app/(dev)/artifacts/fixtures';

describe('PolarityArtifact', () => {
  it('renders the default payload', () => {
    const html = renderToStaticMarkup(<PolarityArtifact payload={polarityFixture} />);
    expect(html).toMatchSnapshot();
  });

  it('shows the DCEP badge for solid-core MIG by default', () => {
    const html = renderToStaticMarkup(<PolarityArtifact payload={polarityFixture} />);
    expect(html).toContain('DCEP');
  });
});
