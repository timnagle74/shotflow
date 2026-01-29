// Video Player Types

export type BurnInPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center';

export interface BurnInConfig {
  enabled: boolean;
  position: BurnInPosition;
}

export interface BurnInSettings {
  shotCode: BurnInConfig;
  frameNumber: BurnInConfig;
  timecode: BurnInConfig;
  projectName: BurnInConfig;
  date: BurnInConfig;
  watermark: BurnInConfig;
  clientName: BurnInConfig;
}

export type AspectRatio = '2.39:1' | '1.85:1' | '16:9' | '4:3' | '1:1' | 'none';

export interface AspectRatioInfo {
  label: string;
  ratio: number;
  description: string;
}

export const ASPECT_RATIOS: Record<AspectRatio, AspectRatioInfo> = {
  '2.39:1': { label: '2.39:1', ratio: 2.39, description: 'Scope (Anamorphic)' },
  '1.85:1': { label: '1.85:1', ratio: 1.85, description: 'Flat (Theatrical)' },
  '16:9': { label: '16:9', ratio: 16/9, description: 'HD / UHD' },
  '4:3': { label: '4:3', ratio: 4/3, description: 'Academy' },
  '1:1': { label: '1:1', ratio: 1, description: 'Square' },
  'none': { label: 'None', ratio: 0, description: 'No overlay' },
};

export const DEFAULT_BURN_IN_SETTINGS: BurnInSettings = {
  shotCode: { enabled: true, position: 'top-left' },
  frameNumber: { enabled: true, position: 'bottom-left' },
  timecode: { enabled: false, position: 'bottom-center' },
  projectName: { enabled: false, position: 'top-center' },
  date: { enabled: false, position: 'top-right' },
  watermark: { enabled: true, position: 'center' },
  clientName: { enabled: false, position: 'bottom-right' },
};

export interface VideoPlayerProps {
  /** Video source URL */
  src?: string;
  /** Poster/thumbnail image URL */
  poster?: string;
  /** Shot code for burn-in */
  shotCode?: string;
  /** Project name for burn-in */
  projectName?: string;
  /** Client name for burn-in */
  clientName?: string;
  /** Custom watermark text (defaults to "CONFIDENTIAL") */
  watermarkText?: string;
  /** Frame rate for timecode/frame calculations */
  frameRate?: number;
  /** Starting frame number */
  frameStart?: number;
  /** Whether this is client review mode (shows more watermarks, hides some controls) */
  clientMode?: boolean;
  /** Whether to show burn-in controls */
  showBurnInControls?: boolean;
  /** Whether to show aspect ratio controls */
  showAspectRatioControls?: boolean;
  /** Callback when frame changes */
  onFrameChange?: (frame: number) => void;
  /** Additional class name */
  className?: string;
}
