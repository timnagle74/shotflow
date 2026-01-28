// Mock data for development without database
export const mockUsers = [
  { id: '1', name: 'Tim Hampton', email: 'tim@studio.com', role: 'ADMIN' as const, image: null },
  { id: '2', name: 'Sarah Chen', email: 'sarah@studio.com', role: 'SUPERVISOR' as const, image: null },
  { id: '3', name: 'Alex Rivera', email: 'alex@studio.com', role: 'ARTIST' as const, image: null },
  { id: '4', name: 'Jordan Mills', email: 'jordan@client.com', role: 'CLIENT' as const, image: null },
  { id: '5', name: 'Casey Brooks', email: 'casey@studio.com', role: 'ARTIST' as const, image: null },
  { id: '6', name: 'Morgan Lee', email: 'morgan@studio.com', role: 'COORDINATOR' as const, image: null },
  { id: '7', name: 'Pixel Perfect VFX', email: 'team@pixelperfect.com', role: 'VFX_VENDOR' as const, image: null },
];

export const mockProjects = [
  { id: 'p1', name: 'Nebula Rising', code: 'NEB01', status: 'ACTIVE' as const, createdAt: new Date('2024-01-15') },
  { id: 'p2', name: 'Iron Citadel', code: 'IRON02', status: 'ACTIVE' as const, createdAt: new Date('2024-03-01') },
  { id: 'p3', name: 'Whisper Protocol', code: 'WHSP01', status: 'ON_HOLD' as const, createdAt: new Date('2023-11-20') },
];

export const mockSequences = [
  { id: 's1', projectId: 'p1', name: 'Opening Battle', code: 'SEQ010', sortOrder: 1 },
  { id: 's2', projectId: 'p1', name: 'Space Station', code: 'SEQ020', sortOrder: 2 },
  { id: 's3', projectId: 'p1', name: 'Planet Surface', code: 'SEQ030', sortOrder: 3 },
  { id: 's4', projectId: 'p2', name: 'Fortress Exterior', code: 'SEQ010', sortOrder: 1 },
  { id: 's5', projectId: 'p2', name: 'Interior Hall', code: 'SEQ020', sortOrder: 2 },
];

export const mockShots = [
  { id: 'sh1', sequenceId: 's1', code: 'SEQ010_0010', description: 'Wide establishing — fleet approaching', status: 'APPROVED' as const, complexity: 'HERO' as const, assignedToId: '3', dueDate: new Date('2024-06-15'), frameStart: 1001, frameEnd: 1120, handleHead: 8, handleTail: 8, notes: 'Director wants more debris field density' },
  { id: 'sh2', sequenceId: 's1', code: 'SEQ010_0020', description: 'CU pilot reaction', status: 'IN_PROGRESS' as const, complexity: 'MEDIUM' as const, assignedToId: '5', dueDate: new Date('2024-06-20'), frameStart: 1001, frameEnd: 1065, handleHead: 8, handleTail: 8, notes: null },
  { id: 'sh3', sequenceId: 's1', code: 'SEQ010_0030', description: 'Missile launch sequence', status: 'INTERNAL_REVIEW' as const, complexity: 'COMPLEX' as const, assignedToId: '3', dueDate: new Date('2024-06-18'), frameStart: 1001, frameEnd: 1200, handleHead: 8, handleTail: 8, notes: 'Smoke trails need reference match' },
  { id: 'sh4', sequenceId: 's2', code: 'SEQ020_0010', description: 'Station exterior orbit', status: 'NOT_STARTED' as const, complexity: 'HERO' as const, assignedToId: null, dueDate: new Date('2024-07-01'), frameStart: 1001, frameEnd: 1300, handleHead: 8, handleTail: 8, notes: null },
  { id: 'sh5', sequenceId: 's2', code: 'SEQ020_0020', description: 'Docking bay door open', status: 'CLIENT_REVIEW' as const, complexity: 'COMPLEX' as const, assignedToId: '5', dueDate: new Date('2024-06-10'), frameStart: 1001, frameEnd: 1150, handleHead: 8, handleTail: 8, notes: 'Client wants to see v003 first' },
  { id: 'sh6', sequenceId: 's3', code: 'SEQ030_0010', description: 'Hero lands on surface', status: 'IN_PROGRESS' as const, complexity: 'HERO' as const, assignedToId: '3', dueDate: new Date('2024-06-25'), frameStart: 1001, frameEnd: 1180, handleHead: 8, handleTail: 8, notes: null },
  { id: 'sh7', sequenceId: 's3', code: 'SEQ030_0020', description: 'Dust storm reveal', status: 'FINAL' as const, complexity: 'MEDIUM' as const, assignedToId: '5', dueDate: new Date('2024-05-30'), frameStart: 1001, frameEnd: 1090, handleHead: 8, handleTail: 8, notes: null },
  { id: 'sh8', sequenceId: 's4', code: 'SEQ010_0010', description: 'Fortress wide shot', status: 'NOT_STARTED' as const, complexity: 'HERO' as const, assignedToId: null, dueDate: new Date('2024-07-15'), frameStart: 1001, frameEnd: 1250, handleHead: 8, handleTail: 8, notes: null },
  { id: 'sh9', sequenceId: 's4', code: 'SEQ010_0020', description: 'Gate mechanism CU', status: 'IN_PROGRESS' as const, complexity: 'COMPLEX' as const, assignedToId: '3', dueDate: new Date('2024-07-10'), frameStart: 1001, frameEnd: 1080, handleHead: 8, handleTail: 8, notes: null },
  { id: 'sh10', sequenceId: 's5', code: 'SEQ020_0010', description: 'Throne room reveal', status: 'NOT_STARTED' as const, complexity: 'HERO' as const, assignedToId: null, dueDate: new Date('2024-07-20'), frameStart: 1001, frameEnd: 1350, handleHead: 8, handleTail: 8, notes: 'CG set extension + FX torch fire' },
  { id: 'sh11', sequenceId: 's2', code: 'SEQ020_0030', description: 'Airlock decompression', status: 'REVISIONS' as const, complexity: 'COMPLEX' as const, assignedToId: '3', dueDate: new Date('2024-06-28'), frameStart: 1001, frameEnd: 1140, handleHead: 8, handleTail: 8, notes: 'Client wants more dramatic lighting on the decompression effect' },
];

export const mockVersions = [
  { id: 'v1', shotId: 'sh1', versionNumber: 1, createdById: '3', status: 'REVISE' as const, description: 'Initial comp', createdAt: new Date('2024-05-01') },
  { id: 'v2', shotId: 'sh1', versionNumber: 2, createdById: '3', status: 'REVISE' as const, description: 'Updated debris density', createdAt: new Date('2024-05-10') },
  { id: 'v3', shotId: 'sh1', versionNumber: 3, createdById: '3', status: 'APPROVED' as const, description: 'Final tweaks per client notes', createdAt: new Date('2024-05-20') },
  { id: 'v4', shotId: 'sh2', versionNumber: 1, createdById: '5', status: 'WIP' as const, description: 'WIP roto + comp', createdAt: new Date('2024-06-01') },
  { id: 'v5', shotId: 'sh3', versionNumber: 1, createdById: '3', status: 'PENDING_REVIEW' as const, description: 'Smoke sim v1', createdAt: new Date('2024-06-05') },
  { id: 'v6', shotId: 'sh5', versionNumber: 1, createdById: '5', status: 'REVISE' as const, description: 'Door anim + lighting', createdAt: new Date('2024-05-15') },
  { id: 'v7', shotId: 'sh5', versionNumber: 2, createdById: '5', status: 'PENDING_REVIEW' as const, description: 'Updated per supe notes', createdAt: new Date('2024-05-28') },
  { id: 'v8', shotId: 'sh7', versionNumber: 1, createdById: '5', status: 'APPROVED' as const, description: 'Final delivery', createdAt: new Date('2024-05-25') },
];

export const mockNotes = [
  { id: 'n1', versionId: 'v1', authorId: '2', content: 'Debris field needs more density in upper-left quadrant. See reference frame 1045.', frameReference: 1045, createdAt: new Date('2024-05-02') },
  { id: 'n2', versionId: 'v2', authorId: '2', content: 'Much better. One more pass on the large chunk at frame 1080 — motion blur looks off.', frameReference: 1080, createdAt: new Date('2024-05-11') },
  { id: 'n3', versionId: 'v3', authorId: '4', content: 'Looks great. Approved.', frameReference: null, createdAt: new Date('2024-05-21') },
  { id: 'n4', versionId: 'v5', authorId: '2', content: 'Smoke trails are too uniform. Add variation in density and speed.', frameReference: 1100, createdAt: new Date('2024-06-06') },
];

export const mockDeliverySpecs = [
  {
    id: 'ds1',
    projectId: 'p1',
    resolution: '2048x1080 (2K)',
    format: 'OpenEXR',
    frameRate: '23.976',
    colorSpace: 'ACES AP0 (Linear)',
    bitDepth: '16-bit Half Float',
    handlesHead: 8,
    handlesTail: 8,
    namingConvention: '{PROJECT}_{SEQ}_{SHOT}_v{VER}.{FRAME}.exr',
    audioRequirements: 'N/A — VFX only',
    additionalNotes: 'All comps must include utility passes (depth, motion vectors, crypto)',
  },
  {
    id: 'ds2',
    projectId: 'p2',
    resolution: '3840x2160 (4K UHD)',
    format: 'OpenEXR',
    frameRate: '24',
    colorSpace: 'ACEScg',
    bitDepth: '16-bit Half Float',
    handlesHead: 12,
    handlesTail: 12,
    namingConvention: '{PROJECT}_{SEQ}_{SHOT}_v{VER}.{FRAME}.exr',
    audioRequirements: 'Sync reference WAV required',
    additionalNotes: 'HDR deliverables may be requested for select hero shots',
  },
  {
    id: 'ds3',
    projectId: 'p3',
    resolution: '1920x1080 (HD)',
    format: 'DPX',
    frameRate: '23.976',
    colorSpace: 'Rec.709',
    bitDepth: '10-bit Log',
    handlesHead: 8,
    handlesTail: 8,
    namingConvention: '{SHOW}_{SEQ}_{SHOT}_v{VER}.{FRAME}.dpx',
    audioRequirements: 'N/A',
    additionalNotes: null,
  },
];

export function getDeliverySpecsForProject(projectId: string) {
  return mockDeliverySpecs.find(ds => ds.projectId === projectId) || null;
}

// Helper to get enriched data
export function getShotsForProject(projectId: string) {
  const seqs = mockSequences.filter(s => s.projectId === projectId);
  return mockShots
    .filter(sh => seqs.some(s => s.id === sh.sequenceId))
    .map(sh => ({
      ...sh,
      sequence: seqs.find(s => s.id === sh.sequenceId)!,
      assignedTo: sh.assignedToId ? mockUsers.find(u => u.id === sh.assignedToId) : null,
      versions: mockVersions.filter(v => v.shotId === sh.id),
    }));
}

export function getStatusCounts(projectId: string) {
  const shots = getShotsForProject(projectId);
  const counts: Record<string, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    INTERNAL_REVIEW: 0,
    CLIENT_REVIEW: 0,
    REVISIONS: 0,
    APPROVED: 0,
    FINAL: 0,
  };
  shots.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
  return counts;
}
