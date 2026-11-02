# Presence

The conversational surface draws the digital-human mesh in the browser. If that file fails, the console falls back to the Microsoft mesh, and to a point cloud only if that mesh also fails. The Microsoft mesh is not the character. It is not a video and it does not replace the television home. Open it at `/presence`, or from the home “ask” control. On a phone the figure fills the viewport and the microphone, camera, and reply stay in a bottom sheet. The backdrop follows the device’s outside forecast and is separate from the simulated room climate.

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

The figure loaded by `/presence` is `apps/console/public/presence/digital-human/female-executive.glb`. The glTF pose is Y-up and faces +Z. The console keeps the authored materials, plays the Idle clip before showing the mesh, and frames the head and shoulders. Speech moves Oculus viseme morph targets. `jawOpen` is only a small companion on open vowels. High, medium, and low change the pixel ratio. Low also skips the additive eye aim. There is one mesh, not three geometry variants. The running page measures frames on that device and can step down. A low measurement wins over a high core count. This repository does not record a frame rate for a specific ARM television.

If this file fails to load, the Microsoft mesh is the fallback, and the point sample follows only if that mesh fails too. Conversation text does not wait for the mesh.

## Digital human, not finished

`packages/presence` owns `morphFrame`, `blendMorphs`, and `clipIntent`. The console renderer owns the GLB, the animation mixer, and the lights. The same controller is used for every profession.

The export contains 69 bones and 34 morph targets, listed in `digitalHumanBones` and `digitalHumanMorphs`. Face bones are Neck, Head, HeadTop_End, Jaw, LeftEye, and RightEye. Blink, brow, and mouth shapes are morphs, including `viseme_PP`, `viseme_FF`, `viseme_TH`, `viseme_DD`, `viseme_kk`, `viseme_CH`, `viseme_SS`, `viseme_nn`, `viseme_RR`, `viseme_aa`, `viseme_E`, `viseme_I`, `viseme_O`, and `viseme_U`.

Authored clips used by the controller are Idle, Talk, Wave, and Laugh. Breathing, listening, and thinking reuse Idle. Goodbye reuses Wave and is not wired to a state. Pointing, presenting, confirming, surprised, and concerned have no clip. Concerned and curious are morphs only.

`speechSynthesis` does not supply phoneme times. The console uses `character-fallback`: one character becomes one viseme, then the weights ease toward the morph. A provider that does send marks uses `cueFromMarks`. There is no Spanish forced aligner in this repository. The silent preview is labeled `silent-gesture`.

`digitalHumanComplete` is false. These steps are not done:

- Import into Blender, retopology, and a facial rig authored for this product.
- Separate takes for breathing, pointing, presenting, confirming, surprised, concerned, and goodbye.
- High, medium, and low meshes of the same character.
- A measured memory, frame-rate, and latency report from a signed-in browser session.
- A video of a Spanish conversation, including an interruption back to idle.

Do not describe this export as a finished character.

## Projection hardware

A volumetric projector, light field, or lenticular panel is outside this software MVP. Do not describe that hardware as supported.

The presence shows the active profession when one is activated at `/profiles`. The same figure is used for every profession.

## Avatar sources that were not shipped

Avaturn and MetaHuman were checked as replacements for the Microsoft mesh. Neither produced a file this repository can load.

Avaturn (`https://avaturn.dev/`) does not grant a commercial license for this application. Goodsize Inc. terms, last updated 4 October 2024 at `https://avaturn.live/terms-of-use`, classify user 3D models as Goodsize Content. Section 7 grants a personal, non-transferable, revocable license and withholds commercial use, reproduction, distribution, and public display unless Goodsize gives prior written permission. The developer integration is an iframe on `*.avaturn.dev` plus an account at `developer.avaturn.me`. It does not publish a stock adult female glTF. The AVTR-1 renderer and streamer separately forbid every commercial use without a written license (`https://avaturn.live/licensing`). The presence therefore does not embed the Avaturn iframe or vendor an exported model.

MetaHuman (`https://www.metahuman.com/license`) may be used outside Unreal Engine under the Unreal Engine EULA. That use is free below 1 million USD annual gross revenue; above that threshold, rendering a MetaHuman outside Unreal Engine needs an Unreal Engine seat license. A character can only be created inside Unreal Engine 5.6 or later, and authoring calls Epic cloud services for autorigging and texture synthesis. Unreal Engine 5.6 and the MetaHuman plugins are installed on the development machine. The plugin content is the creator archetype (`SKM_Face` and body templates), not an assembled adult woman with skin, hair, eyes, and a facial rig. No MetaHuman glTF exists in the local Unreal projects. The archetype is not extracted into this repository. An operator who authors a character in the editor can export glTF for a later local load; that file stays out of the public tree until Epic's content terms allow publishing the source mesh.

Ara 3D Gen (`https://github.com/olatunde85/3d-gen`) was run from an independent directory, not as a Physical OS dependency. The generator code is MIT, copyright 2026 Josh Ola. The body, skin, hair, eyes, and clothing come from MakeHuman and are CC0 1.0, dedicated in September 2020 by Data Collection AB, Joel Palmius, and Jonas Hauquier. The motion clips are retargeted from the CMU Graphics Lab Motion Capture Database. CMU allows commercial products and forbids reselling the motion data on its own. A shipped clip still needs this acknowledgement: "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217."

The Female Executive preset exported as a high-detail GLB: 172 cm, 23 materials, 69 bones, 34 morph targets, and 77 clips. The file in the console is 17,044,040 bytes. The preview of an earlier render is `docs/architecture/female-executive-preview.png`. The skin and hair still read as a game mesh: smooth skin, flat hair, and a seam on the crown. No particle layer is drawn on top of this preset. The license note is `apps/console/public/presence/digital-human/LICENSE.txt`.
