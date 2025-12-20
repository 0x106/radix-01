import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
    }),
    conversations: i.entity({
      title: i.string(),
      createdAt: i.number().indexed(),
      icon: i.string().optional(),
    }),
    messages: i.entity({
      role: i.string(), // "user" | "assistant"
      content: i.string(),
      createdAt: i.number(),
    }),
    containers: i.entity({
      label: i.string(),
      description: i.string().optional(),
    }),
    widgets: i.entity({
      key: i.string().indexed(), // Useful for lookups
      type: i.string(),
      label: i.string(),
      description: i.string().optional(),
      props: i.json().optional(), // Store specific props like options, min, max
      value: i.json().optional(), // Store the user's input value
    }),
  },
  links: {
    // User -> Conversations
    userConversations: {
      forward: {
        on: "conversations",
        has: "one",
        label: "owner",
        onDelete: "cascade",
      },
      reverse: { on: "$users", has: "many", label: "conversations" },
    },
    // Conversation -> Messages
    conversationMessages: {
      forward: {
        on: "messages",
        has: "one",
        label: "conversation",
        onDelete: "cascade",
      },
      reverse: { on: "conversations", has: "many", label: "messages" },
    },
    // Conversation -> Containers
    conversationContainers: {
      forward: {
        on: "containers",
        has: "one",
        label: "conversation",
        onDelete: "cascade",
      },
      reverse: { on: "conversations", has: "many", label: "containers" },
    },
    // Container -> Widgets
    containerWidgets: {
      forward: {
        on: "widgets",
        has: "one",
        label: "container",
        onDelete: "cascade",
      },
      reverse: { on: "containers", has: "many", label: "widgets" },
    },
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
