// app/api/query/route.ts
import { openai } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { ChatResponseSchema } from "@/lib/schemas";

export const maxDuration = 60;

// export async function POST(req: Request) {
//   const { messages } = await req.json();

//   const systemPrompt = `
//     You are an Interface Generator Agent. Your goal is to help the user accomplish a task by dynamically generating a user interface.

//     ### Guidelines:
//     1. **Analyze the Context**: Determine what information is missing.
//     2. **Choose Widgets**: Use 'text_input', 'textarea', 'radio_group', 'checkbox_group', 'slider', or 'toggle'.
//     3. **Be Efficient**: 2-4 relevant widgets per turn.
//     4. **Variable Keys**: Use descriptive keys (e.g., 'hero_name').

//     ### Interaction Flow:
//     - **Generating Interfaces**: If you need information, generate a 'message' (context) and a list of 'widgets'.
//     - **Processing Responses**:
//       - The user may respond with a JSON block labeled "[Form Submission]" containing the widgets you previously sent, but now populated with a "response" field.
//       - Parse this JSON to understand the user's choices.
//       - **Do not** simply repeat the data back. Acknowledge it in your next 'message' and either generate the *next* set of widgets (if more info is needed) or finalize the task.

//     ### Final Output:
//     - If the task is complete, provide the final result in the 'message' field with \`widgets: []\`.
//   `;

//   const result = streamObject({
//     model: openai("gpt-5.2"),
//     schema: ChatResponseSchema,
//     system: systemPrompt,
//     messages: messages,
//   });

//   return result.toTextStreamResponse();
// }

export async function POST(req: Request) {
  // Now we expect 'messages' AND 'currentWidgets' from the body
  const { messages, currentWidgets } = await req.json();

  const systemPrompt = `
    You are an Interface State Manager. You maintain a global UI state based on the conversation.

    ### Current UI State:
    ${JSON.stringify(currentWidgets || [], null, 2)}

    ### Guidelines:
    1. **State Persistence**: Widgets you create persist across the entire conversation.
    2. **Actions**:
       - 'ADD': Create a new widget.
       - 'UPDATE': Modify an existing widget (change labels, options, etc.). Note: Do not use this to update user 'responses', only the UI configuration.
       - 'DELETE': Remove a widget no longer needed.
    3. **Efficiency**: Only emit actions for things that need to change. If a widget is fine as is, do not include an action for it.
    4. **Context**: Use the 'message' field to explain why you are adding/removing UI elements.
  `;

  const result = streamObject({
    model: openai("gpt-5.2"),
    schema: ChatResponseSchema,
    system: systemPrompt,
    messages: messages,
  });

  return result.toTextStreamResponse();
}
