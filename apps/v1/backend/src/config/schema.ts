import z from 'zod';

export const AppConfigSchema = z.object({
  server: z.object({
    port: z.number().default(4182),
    host: z.string().default('0.0.0.0'),
  }),
  sync: z.object({
    enabled: z.boolean().default(false),
    remoteUrl: z.string().optional(),
    interval: z.string().default('*/5 * * * *'), // Cron syntax
    branch: z.string().default('main'),
  }),
  ai: z.object({
    providers: z.record(z.string(), z.union([
      z.object({
        type: z.literal('local'),
        embeddingModel: z.string().default('Xenova/bge-m3'),
      }),
      z.object({
        type: z.literal('vertex'),
        projectId: z.string().optional(), // Optional (ADC)
        location: z.string().optional(),  // e.g. 'us-central1'
        embeddingModel: z.string().default('gemini-embedding-001'),
        chatModel: z.string().default('gemini-2.5-flash'),
      })
    ])).default({
      'local': { type: 'local', embeddingModel: 'Xenova/bge-m3' }
    }),
    defaults: z.object({
      embedding: z.array(z.string()).default(['local']),
      agent: z.string().default('local'),
    }).default({
      embedding: ['local'],
      agent: 'local'
    }),
  }),
  // System managed paths, not in json usually but resolved at runtime
  storage: z.object({
    dataDir: z.string(), 
  }).optional(), 
});

// Export Partial type for updates
// Note: Using .partial() as deepPartial() is not available in all Zod versions.
export const AppConfigUpdateSchema = AppConfigSchema.partial(); 
export type AppConfigUpdate = z.infer<typeof AppConfigUpdateSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

