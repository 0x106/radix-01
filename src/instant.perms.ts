// import type { InstantRules } from "@instantdb/react";

// const rules = {
//   conversations: {
//     allow: {
//       view: "auth.id == data.owner.id",
//       create: "auth.id == data.owner.id",
//       update: "auth.id == data.owner.id",
//       delete: "auth.id == data.owner.id",
//     },
//     bind: ["isOwner", "auth.id == data.owner.id"],
//   },
//   // Allow simple access to children if they belong to an owned conversation
//   // (Simplified for brevity; in production, verify the chain of ownership)
//   messages: {
//     allow: {
//       view: "true",
//       create: "true",
//       update: "true",
//       delete: "true",
//     },
//   },
//   containers: {
//     allow: {
//       view: "true",
//       create: "true",
//       update: "true",
//       delete: "true",
//     },
//   },
//   widgets: {
//     allow: {
//       view: "true",
//       create: "true",
//       update: "true",
//       delete: "true",
//     },
//   },
// } satisfies InstantRules;

// export default rules;
