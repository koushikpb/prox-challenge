import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { computeBand, DutyCycleArtifact } from './DutyCycleArtifact';
import { dutyCycleFixture } from '@/app/(dev)/artifacts/fixtures';

describe('DutyCycleArtifact', () => {
  it('renders the default payload without fetching', () => {
    const html = renderToStaticMarkup(<DutyCycleArtifact payload={dutyCycleFixture} />);
    expect(html).toMatchSnapshot();
  });
});

describe('computeBand', () => {
  const mig240 = {
    process: 'MIG' as const,
    input_voltage: 240 as const,
    rated: { amperage: 200, duty_cycle_pct: 25, work_minutes: 2.5, rest_minutes: 7.5 },
    continuous: { amperage: 115, duty_cycle_pct: 100 as const },
    current_range: { min_a: 30, max_a: 220 },
    ocv_v: 86,
    source_page: 7,
  };

  it('labels current ≥ rated as rated band', () => {
    expect(computeBand(200, mig240).band).toBe('rated');
    expect(computeBand(220, mig240).band).toBe('rated');
  });

  it('labels current in [continuous, rated) as 100% continuous', () => {
    expect(computeBand(115, mig240).band).toBe('100pct');
    expect(computeBand(150, mig240).band).toBe('100pct');
  });

  it('labels current below continuous as below_range', () => {
    expect(computeBand(50, mig240).band).toBe('below_range');
  });

  it('labels current above max as out_of_range', () => {
    expect(computeBand(250, mig240).band).toBe('out_of_range');
  });
});
