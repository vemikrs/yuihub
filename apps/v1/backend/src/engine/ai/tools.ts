import z from 'zod';

export interface ToolDef {
  name: string;
  description: string;
  parameters: z.ZodType<any>; // Zod schema for validation
}
