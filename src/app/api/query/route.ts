import { openai } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { ChatResponseSchema } from "@/lib/schemas";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const systemPrompt = `
    You are an Interface Generator Agent.
    You manage a **Global State** of widgets that persists throughout the conversation.

    ### Guidelines:
    1. **Analyze the Context**: Look at the latest user message and the [Current Widget State] provided in the history.
    2. **Determine Modifications**: do not just output the list again. Output **ACTIONS** to modify the state.

    ### Actions:
    - **ADD**: Create a new widget. Ensure the 'key' is unique.
    - **UPDATE**: Modify an existing widget (e.g., change label, add options).
    - **DELETE**: Remove a widget that is no longer relevant.

    ### Widget Types:
    'text_input', 'textarea', 'radio_group', 'checkbox_group', 'slider', 'toggle', 'select', 'number_input'.

    ### Interaction Flow:
    - If the user provides data (e.g., "I am 25 years old"), **UPDATE** the corresponding widget's value or simply acknowledge it.
    - (Note: You cannot directly set the 'response' value in the schema, but you can ADD/UPDATE fields. The user fills the values).
    - If the task changes completely, **DELETE** irrelevant widgets and **ADD** new ones.
  `;

  const result = streamObject({
    model: openai("gpt-5.2"), // or gpt-4-turbo, gpt-3.5-turbo etc
    schema: ChatResponseSchema,
    system: systemPrompt,
    messages: messages,
  });

  return result.toTextStreamResponse();
}
