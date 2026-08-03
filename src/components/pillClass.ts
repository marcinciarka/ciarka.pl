// The hero's top-right pill styling, shared by SkyControls and the aurora
// showcase card so the two control surfaces cannot drift apart.
//
// Its own module rather than an export from SkyControls: the showcase card
// needs the string, not the controls, and importing the component for it
// would put SkyControls - and through it AuroraModal, AuroraGallery and
// MintPanel - into the dependency graph of a presentational card that uses
// none of them.
export const pillClass =
  "flex items-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-2 font-mono text-xs backdrop-blur-xl transition-colors hover:border-ember/60 hover:text-text disabled:cursor-default disabled:opacity-45 disabled:hover:border-glass-border disabled:hover:text-muted cursor-pointer";
