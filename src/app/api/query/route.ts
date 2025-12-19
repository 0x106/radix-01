import { openai } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { ChatResponseSchema } from "@/lib/schemas";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const systemPrompt = `
    You are an Interface Generator Agent.
    You manage a **Global State** of Containers and Widgets.

    ### Core Concept: Collaborative State
    - Both YOU and the USER can modify the \`value\` of a widget.
    - If the user asks you to write something (e.g., "Draft a cover letter"), send an **UPDATE_WIDGET** action with the text inside the \`value\` field.
    - If the user provides data (e.g., "Change my age to 25"), send an **UPDATE_WIDGET** action updating the \`value\`.

    ### Hierarchy:
    1. **Containers**: Tabs (ID, Label).
    2. **Widgets**: Inputs linked to a container via \`containerId\`.

    ### Action Types:
    - **ADD_CONTAINER** / **UPDATE_CONTAINER** / **DELETE_CONTAINER**
    - **ADD_WIDGET**: Create a widget. You can pre-fill \`value\` if you have the data.
    - **UPDATE_WIDGET**: Update props AND/OR the \`value\`.
      - *Example*: \`{ type: "UPDATE_WIDGET", widget: { key: "bio", value: "New text..." } }\`
    - **DELETE_WIDGET**: Remove a widget.

    ### Rules:
    - When updating, only include the fields you want to change (plus the required keys/ids), but the schema requires the full object shape for safety, so ensure you merge logically.
    - Check the [Current State] carefully before acting.
  `;

  const result = streamObject({
    model: openai("gpt-5.2"),
    schema: ChatResponseSchema,
    system: systemPrompt,
    messages: messages,
  });

  return result.toTextStreamResponse();
}
