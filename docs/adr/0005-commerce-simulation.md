# ADR 0005 — Commerce stays a simulated mode

Self-service checkout is a separate package and route. The television home remains the default screen.

The only payment provider in this version signs simulation notices with a process secret. Production card capture, cash, and receipt printers are out of scope. Fulfillment uses a simulated locker and does not call the device command path for locks or motors.

A later live provider must verify a server-side callback, keep the same order states, and stay disabled until that verification is tested.
