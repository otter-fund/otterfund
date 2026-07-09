// Static image imports (e.g. otter-mark.svg in bulga/logo.tsx) are typed by
// next/image-types/global, which is normally referenced from the generated,
// gitignored next-env.d.ts. CI typechecks a fresh checkout where that file
// doesn't exist yet, so reference it from a committed declaration too.
/// <reference types="next/image-types/global" />
