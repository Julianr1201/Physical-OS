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
export { chooseTier, particleBudget, renderScale, shellBudget, type PerformanceTier } from './tier.js';
export { frameAvatar, applyFrame, extentMatchesUp, femaleAdult01Axes, presenceFocus, type AvatarAxes, type AvatarFrame, type Vec3 } from './avatar-frame.js';
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
  visemeFromBoundary,
  gestureMouth,
  type SpeechCue,
  type Viseme,
  type VisualPose,
  type BlinkClock,
} from './visual.js';
export {
  animationLibrary,
  blendMorphs,
  clipIntent,
  cueFromMarks,
  digitalHumanBones,
  digitalHumanComplete,
  digitalHumanMorphs,
  digitalHumanUrl,
  morphFrame,
  type AnimationStatus,
  type ClipIntent,
  type LibraryClip,
  type LipsyncMode,
  type VisemeMark,
} from './digital-human.js';
export {
  decayLevel,
  sparkDensity,
  sparkMood,
  sparkMoods,
  sparkRuntime,
  spanishFemaleVoice,
  type SparkLink,
  type SparkMood,
} from './spark.js';
