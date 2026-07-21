import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A integração de 60 semanas usa IndexedDB real (fake-indexeddb) e pode
    // passar do timeout padrão em máquinas mais lentas. O limite explícito
    // evita uma suíte vermelha por infraestrutura, sem esconder travamentos
    // indefinidos.
    testTimeout: 60_000,
  },
});
