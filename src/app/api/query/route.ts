// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { ChatResponseSchema } from "@/lib/schemas";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const systemPrompt = `
    You are an Interface Generator Agent. Your goal is to help the user accomplish a task (e.g., writing a story, planning a trip, generating code) by dynamically generating a user interface.

    Instead of asking for information purely through text chat, you should generate specific UI 'widgets' that allow the user to input data structuredly.

    ### Guidelines:
    1. **Analyze the Context**: Determine what information is missing to fulfill the user's request.
    2. **Choose the Right Widget**:
       - Use 'text_input' for short names or titles.
       - Use 'textarea' for long descriptions or prompts.
       - Use 'radio_group' when the user must pick exactly one option from a list (e.g., Tone: Happy, Sad).
       - Use 'checkbox_group' for multi-select (e.g., Genres: Sci-Fi, Horror).
       - Use 'slider' for intensity or ranges (e.g., Creativity Level).
       - Use 'toggle' for simple yes/no settings.
    3. **Be Efficient**: Do not overwhelm the user. specific 2-4 relevant widgets per turn is usually best.
    4. **Variable Keys**: Ensure the 'key' field in widgets is descriptive (e.g., use 'hero_name' instead of 'var1').

    ### Interaction Flow:
    - If the user sends a general request ("Help me write a character"), reply with a message and a form of widgets (Name, Age, Role, etc.).
    - If the user has already provided data, acknowledge it in the 'message' field and move to the next step or generate the final output in the 'message' field.
  `;

  const result = streamObject({
    model: openai("gpt-5.2"),
    schema: ChatResponseSchema,
    system: systemPrompt,
    messages: messages,
  });

  return result.toTextStreamResponse();
}
