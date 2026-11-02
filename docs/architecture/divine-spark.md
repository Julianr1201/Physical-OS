# Divine Spark

Divine Spark is the persistent presence of Physical OS. It is a local canvas drawing, mounted once in the console shell, so a route change does not reset the conversation or open a second microphone.

The drawing uses the existing presence states. `OFFLINE` means the console could not read the local API. It does not mean a cloud model is running.

## What runs locally

The light is drawn with canvas 2D on the device. It does not load a human mesh, Unreal, or a remote renderer. High, medium, and low tiers change the filament count and the canvas pixel ratio. The page records frames on that device. This repository does not claim a frame rate for a specific ARM television.

## What does not run yet

Piper is not installed. whisper.cpp is not installed. Spanish speech uses the browser only when a voice whose name matches a female Spanish voice is present. That match is not a listened test, so `mexicanAccentValidated` stays false. If no such voice exists, the reply stays on screen and the spark does not speak with a male voice.

Browser speech synthesis cannot be routed through an `AnalyserNode`. While a chosen voice is actually speaking, the waves follow that utterance's boundary timing. The microphone meter is a real analyser and only runs after the operator turns the microphone on.

The studio screens keep their current controls. They were not redrawn as a new console in this pass. The human glTF files remain in the tree and are not drawn.

## Acceptance that is still open

A listened female Mexican voice, offline recognition, a measured cheap-hardware report, and a video of a signed-in conversation are not done.
