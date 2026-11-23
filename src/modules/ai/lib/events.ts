// Fired by the navbar "XYZ AI" item (and anywhere else) to open the assistant.
//
// ⚠️ Lives in its own module on purpose. It used to be exported from
// XyzAiWidget.tsx, so the Navbar importing this one string pulled the whole
// assistant (markdown, speech, drag/resize panels) into the first-load bundle of
// every page, defeating the lazy `XyzAiWidgetMount`. Import it from here.
export const XYZ_AI_OPEN_EVENT = "xyz-ai:open";
