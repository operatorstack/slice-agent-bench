# agents/zca

Slice-based (ZCA) coding agent implementation.

## Planned contents

- Projection: extract the minimal code slice relevant to the task
- Canonicalization: normalize the slice into a self-contained representation
- Operation: apply the fix within the isolated slice context
- Verification: validate the change against the slice's test contract
- Integration: merge the slice back into the full repository
