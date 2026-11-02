# CleanYourTV evaluation

Date: 2026-11-01. Source: https://github.com/Gathin23/cleanyourtv

## What was read

The repository README and the raw `LICENSE` file. The GitHub contents API returned 403, so this evaluation does not claim a line-by-line review of every source file. Claims about tools and layout come from the README and the license text.

## What the project is

CleanYourTV is an Android and Google TV debloating tool and a replacement launcher. It is not a device-control platform. The launcher is described as a small native app with no network permission. Companion tools use ADB, including a pure Python client aimed at port 5555, package disable and restore, a recovery helper, and an install script. Stock launchers are identified so the tool can take the home role.

## Licenses

The project license is MIT, copyright 2026 Gathin. The same `LICENSE` file also carries the SIL Open Font License 1.1 for the Outfit font used by the launcher (`launcher/app/src/main/res/font/outfit.ttf`, with `launcher/FONT-LICENSE-OFL.txt`). GitHub reports SPDX `NOASSERTION` because the file is not a single license. Any reuse of the font must keep the OFL notice. No CleanYourTV source was copied into Physical OS.

## Security

Network ADB on port 5555 is plaintext. On some television firmware, any device on the LAN that can reach that port gets a shell. Disabling packages can remove setup, Wi-Fi, or the stock launcher and leave the television in a crash loop. Recovery is often a factory reset, and a firmware update can restore the packages the tool removed. Physical OS must not automate those actions.

## Approaches

### A. Reference only

Keep this document. Do not import, vendor, or shell out to CleanYourTV. If a television appears in Physical OS later, it is a simulated or read-only media device described by our own capability model.

### B. Optional external tool

An operator could run CleanYourTV themselves, outside this process, after they authorize that action on their own hardware. Physical OS would not invoke `adb`, `tv.py`, or the disable list. This is a possible later boundary and is not implemented.

### C. Fork or vendor

Copying the launcher, the debloat lists, or the ADB client would couple Physical OS to a television modification tool, inherit the font license and the MIT attribution, and create a path that disables system packages. That is the wrong dependency for a control plane.

## Decision

Use A. It is the least coupled option and the only one that keeps a write-capable ADB session out of this repository. B remains a documented non-goal until a person explicitly asks for a read-only discovery experiment. C is rejected.

Physical OS does not modify a television, disable a stock launcher, or turn off system updates.
