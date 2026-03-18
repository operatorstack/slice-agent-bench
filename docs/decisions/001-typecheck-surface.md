# Typecheck failure surface via parameterization, not duplication

## Decision
Add typecheck support by parameterizing existing loops and projectors rather than creating parallel typecheck-specific implementations.

## Why
The typecheck surface is architecturally identical to the test surface: failure output → anchor → project slice → edit → verify. Creating separate loop and projector files would duplicate the core architecture by signal type, making future surfaces (lint, runtime) multiplicative rather than additive.

## Rejected Alternatives
- **Separate `zcaTypecheckLoop.ts` / `typecheckProjector.ts`**: duplicates the core loop for each signal type
- **Generic plugin/signal framework**: over-abstraction for a system with two concrete signals
- **Passing anchor structs through the projector interface**: would require changing the `Projector` type signature; instead we compute `entryFile` before calling the existing projector

## Consequence
The loop and projector files now accept optional parameters (`verify`, `systemPrompt`, `entryFile`) with backwards-compatible defaults. Signal-specific logic lives in the agent constructors (`ZCAAgent`, `BaselineAgent`) where it routes to the shared infrastructure. Adding a third signal (e.g., lint) would follow the same pattern: new `runX` function, new prompt, pass `entryFile` — no new loops or projectors.
