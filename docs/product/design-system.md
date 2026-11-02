# Physical Design System V2

The console has two surfaces. They do not share chrome.

Physical Home, Presence, and Profiles use the `.tv` tokens: `#101419`, `#B5D7D2`, and Manrope for display type. Physical Studio, the administrative shell, uses the root tokens: a deep background `#0C1013`, raised paper `#151C22`, and a brass focus color `#C6A27A`. A stored `pos-theme=light` choice restores the paper palette. The default is dark.

Spacing stays on the existing scale. Radius is 2px. Motion is 160ms and turns off under `prefers-reduced-motion`. Icons stay typographic; Lucide, Radix, and Framer Motion were not added because the console already has focusable controls and a native dialog, and those packages would enlarge the television bundle.

Home, presence, and profiles sit on a wallpaper of flat bands from the television palette. The bands follow the outside forecast: day, night, cloud, rain, snow, or storm. There is no gradient fill. On a narrow screen the presence keeps the figure full-viewport and places the microphone, camera, and reply in a bottom sheet.

Studio navigation, section titles, the command list, and connection state call the existing session and overview routes. Simulated environments keep the simulation label. Planned integrations stay unlabeled as available actions.
