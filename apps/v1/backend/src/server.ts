import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

const server = Fastify({
  logger: true
});

// Zod Type Provider Setup
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.get('/health', async () => {
  return { status: 'ok', version: 'v1' };
});

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
