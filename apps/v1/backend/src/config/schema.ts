import z from 'zod';

export const AppConfigSchema = z.object({
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('0.0.0.0'),
  }),
  sync: z.object({
    enabled: z.boolean().default(false),
    remoteUrl: z.string().optional(),
    interval: z.string().default('*/5 * * * *'), // Cron syntax
    branch: z.string().default('main'),
  }),
  ai: z.object({
    provider: z.enum(['local', 'vertex', 'openai']).default('local'),
    modelName: z.string().default('Xenova/all-MiniLM-L6-v2'),
  }),
  // System managed paths, not in json usually but resolved at runtime
  storage: z.object({
    dataDir: z.string(), 
  }).optional(), 
});

// Export Deep Partial type for updates
export const AppConfigUpdateSchema = AppConfigSchema.deepPartial();
export type AppConfigUpdate = z.infer<typeof AppConfigUpdateSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

