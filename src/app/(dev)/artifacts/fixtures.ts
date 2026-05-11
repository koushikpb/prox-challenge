import type { ArtifactPayload } from '@/streaming';

export const dutyCycleFixture: Extract<ArtifactPayload, { type: 'duty_cycle' }> = {
  type: 'duty_cycle',
  process: 'MIG',
  input_voltage: 240,
  amperage: 200,
  duty_cycle_pct: 25,
  work_minutes: 2.5,
  rest_minutes: 7.5,
  source_page: 7,
};

export const polarityFixture: Extract<ArtifactPayload, { type: 'polarity' }> = {
  type: 'polarity',
  process: 'MIG_solid',
  ground_socket: 'Negative',
  electrode_socket: 'Positive',
  polarity_name: 'DCEP',
  source_page: 14,
};

export const settingsFixture: Extract<ArtifactPayload, { type: 'settings' }> = {
  type: 'settings',
  process: 'MIG',
  subprocess: 'solid-core',
  material: 'mild_steel',
  thickness_in: 0.125,
  skill_level: 'moderate',
  gas_required: true,
  gas_scfh_min: 20,
  gas_scfh_max: 30,
  cleanliness: 'clean_minimal_spatter',
  applications: ['General fabrication', 'Sheet metal'],
  source_page: 1,
};

export const troubleshootFixture: Extract<ArtifactPayload, { type: 'troubleshoot' }> = {
  type: 'troubleshoot',
  symptom: 'Porosity in welds',
  tree: [
    {
      node_id: 'root',
      question: 'What setup factor is most likely the cause?',
      options: [
        { label: 'Shielding gas (gas-shielded MIG)', next: 'gas' },
        { label: 'Dirty workpiece or contaminated filler', next: 'workpiece' },
      ],
      source_pages: [37, 40],
    },
    {
      node_id: 'gas',
      cause:
        'Insufficient or incorrect shielding gas: the molten puddle is exposed to atmosphere, trapping nitrogen and oxygen in the bead.',
      fixes: [
        'Increase shielding gas flow to 20–30 SCFH (p. 20)',
        'Check the regulator gauge and verify the cylinder valve is open',
        'Inspect hose and torch O-rings for leaks',
      ],
      source_pages: [37, 42],
    },
    {
      node_id: 'workpiece',
      cause:
        'Surface contamination — oil, paint, rust, mill scale, or moisture — burns out during welding and forms gas pockets in the bead.',
      fixes: [
        'Clean the workpiece down to bare metal with a wire brush or grinder',
        'Wipe off oils, coatings, and other residues before welding',
      ],
      source_pages: [37, 40],
    },
  ],
};
