import { z } from 'zod';

export type ToolHandler<I, O> = (input: I) => O | Promise<O>;

export type ToolDefinition<I, O> = {
  name: string;
  description: string;
  input_schema: z.ZodType<I>;
  handler: ToolHandler<I, O>;
};

export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}
