export { sampleFigure, sliceFigure, figureKind, type FigureSample } from './figure.js';
export { replyFromInterpret, lineForExecution, isEcho, type InterpretResult, type CommandOutcome } from './interpret.js';
export {
  defaultPrivacy,
  setMicrophone,
  setCameraGaze,
  assertNoRetention,
  recordingIndicator,
  type PrivacySettings,
  type RecordingIndicator,
} from './privacy.js';
export { absentProvider, acceptProvider, type ProviderSlot } from './providers.js';
export { presenceStates, expressions, type PresenceState, type ExpressionName } from './state.js';
export { chooseTier, particleBudget, renderScale, type PerformanceTier } from './tier.js';
export {
  initialTurn,
  reduceTurn,
  type PresenceTurn,
  type TurnEvent,
  type TurnEffect,
  type EngineReply,
  type SpeechMode,
} from './turn.js';
export { createVad, stepVad, type VadClock } from './vad.js';
export {
  visualFor,
  createBlink,
  advanceBlink,
  mouthFromBoundary,
  gestureMouth,
  type VisualPose,
  type BlinkClock,
} from './visual.js';
