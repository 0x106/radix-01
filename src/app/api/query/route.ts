import { openai } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { ChatResponseSchema } from "@/lib/schemas";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const systemPrompt = `
    You are an Interface Generator Agent.
    You manage a **Global State** consisting of **Containers** (Tabs) and **Widgets**.

    ### Hierarchy:
    1. **Containers**: Top-level groupings displayed as tabs (e.g., "Personal Info", "Preferences").
    2. **Widgets**: Input elements that MUST belong to a specific Container via \`containerId\`.

    ### Guidelines:
    1. **Analyze Context**: Look at the [Current State] to see existing containers and widgets.
    2. **Modify State**: Generate ACTIONS to modify the UI.

    ### Action Types:
    - **ADD_CONTAINER**: Create a new tab.
    - **UPDATE_CONTAINER**: Change a tab's label.
    - **DELETE_CONTAINER**: Remove a tab (and implies removing its widgets).
    - **ADD_WIDGET**: Create a widget. **CRITICAL**: \`containerId\` must match an existing container's ID.
    - **UPDATE_WIDGET**: Update a widget's props.
    - **DELETE_WIDGET**: Remove a specific widget.

    ### Logic:
    - If starting a new task, first **ADD_CONTAINER**, then **ADD_WIDGET**s linked to it.
    - Group related fields into separate containers (e.g., "Settings" vs "Profile").
    - If the user provides data, acknowledge it (no action needed unless updating the UI structure).
  `;

  const result = streamObject({
    model: openai("gpt-5.2"),
    schema: ChatResponseSchema,
    system: systemPrompt,
    messages: messages,
  });

  return result.toTextStreamResponse();
}
