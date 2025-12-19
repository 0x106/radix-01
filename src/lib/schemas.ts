import { z } from "zod";

// --- Primitives ---
const WidgetBase = z.object({
  key: z.string().describe("The unique ID/variable name."),
  containerId: z
    .string()
    .describe("The ID of the container this widget belongs to."),
  label: z.string().describe("The label for the input."),
  description: z.string().optional(),

  // NEW: The 'value' is now part of the schema definition.
  // We use a union to cover strings, numbers, booleans (toggles), and arrays (checkboxes)
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
    .optional()
    .nullable()
    .describe(
      "The current value of the widget. Set this to pre-fill data or update the user's input.",
    ),
});

const OptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

// --- Widget Types ---
export const TextInputSchema = WidgetBase.extend({
  type: z.literal("text_input"),
  placeholder: z.string().optional(),
});

export const TextAreaSchema = WidgetBase.extend({
  type: z.literal("textarea"),
  placeholder: z.string().optional(),
  rows: z.number().default(3),
});

export const NumberInputSchema = WidgetBase.extend({
  type: z.literal("number_input"),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const BooleanToggleSchema = WidgetBase.extend({
  type: z.literal("toggle"),
  defaultChecked: z.boolean().default(false),
});

export const SelectSchema = WidgetBase.extend({
  type: z.literal("select"),
  options: z.array(OptionSchema),
  placeholder: z.string().optional(),
});

export const RadioGroupSchema = WidgetBase.extend({
  type: z.literal("radio_group"),
  options: z.array(OptionSchema),
});

export const CheckboxGroupSchema = WidgetBase.extend({
  type: z.literal("checkbox_group"),
  options: z.array(OptionSchema),
});

export const SliderSchema = WidgetBase.extend({
  type: z.literal("slider"),
  min: z.number().default(0),
  max: z.number().default(100),
  step: z.number().default(1),
  labels: z
    .object({ left: z.string().optional(), right: z.string().optional() })
    .optional(),
});

export const WidgetSchema = z.discriminatedUnion("type", [
  TextInputSchema,
  TextAreaSchema,
  NumberInputSchema,
  BooleanToggleSchema,
  SelectSchema,
  RadioGroupSchema,
  CheckboxGroupSchema,
  SliderSchema,
]);

export const ContainerSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

// --- Actions ---
export const ActionTypeSchema = z.enum([
  "ADD_CONTAINER",
  "UPDATE_CONTAINER",
  "DELETE_CONTAINER",
  "ADD_WIDGET",
  "UPDATE_WIDGET",
  "DELETE_WIDGET",
]);

export const WidgetActionSchema = z.object({
  type: ActionTypeSchema,
  widget: WidgetSchema.optional(),
  container: ContainerSchema.optional(),
  targetId: z.string().optional(),
});

export const ChatResponseSchema = z.object({
  message: z.string(),
  actions: z.array(WidgetActionSchema).optional(),
});

// We no longer need the manual intersection type!
export type Widget = z.infer<typeof WidgetSchema>;
export type Container = z.infer<typeof ContainerSchema>;
export type WidgetAction = z.infer<typeof WidgetActionSchema>;
