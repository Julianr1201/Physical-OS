# Presence

The conversational surface is a point-cloud figure rendered in the browser. It is not a video and it does not replace the television home. Open it at `/presence`, or from the home “ask” control.

`packages/presence` owns the behavior model, privacy defaults, performance tiers, and the sampled figure. It does not import Three.js and it does not call devices. `apps/console` draws the figure and calls the existing interpret and approve routes.

## States

`DORMANT`, `AWAKENING`, `IDLE`, `LISTENING`, `THINKING`, `SPEAKING`, `ACTING`, `ERROR`, `SLEEPING`.

A late reply is ignored when a newer turn has started. Interrupting speech or a pending plan cancels the spoken line and rejects that plan. An approval that has already started is not interrupted. The face returns to a neutral expression after speech. Pleasure is used only after every command in the execution is `verified`.

## Speech

The console checks `SpeechRecognition` and `speechSynthesis`. When either is missing, that channel stays unavailable and the screen says so. Typed utterances still reach `POST /api/v1/intelligence/interpret`. There is no invented transcript and no invented audio. A gesture preview moves the mouth without claiming to speak.

Local and remote providers use the same `ProviderSlot`. None are bundled. A television chipset is not assumed to run a local model.

## Privacy

The microphone and the camera start off. Enabling either shows a visible indicator. The camera, when enabled, only biases gaze from coarse motion in memory. It does not infer emotion and it does not store frames. `retainMedia` stays false.

## Performance

The figure is one instanced billboard draw. The points are sampled from a MIT-licensed Microsoft character mesh (`apps/console/public/presence/female-adult-01.glb`, copyright 2020 Microsoft). The procedural sample remains the fallback if that file does not load. It is still points, not a video. High, medium, and low tiers change the particle count and the pixel ratio. The running page measures frames on that device and can step down. A low measurement wins over a high core count. This repository does not record a frame rate for a specific ARM television.

## Projection hardware

## Projection hardware

A volumetric projector, light field, or lenticular panel is outside this software MVP. Do not describe that hardware as supported.

The presence shows the active profession when one is activated at `/profiles`. The figure itself stays this point cloud.
