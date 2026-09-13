import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/helpers/loadTestEnv.ts"],
    // اختبارات التكامل تشارك نفس قاعدة بيانات Postgres محليًا؛ تشغيل ملفات الاختبار
    // بالتوازي يسبب تعارض اتصالات/معاملات متزامنة يظهر كأخطاء "not found" زائفة.
    fileParallelism: false,
  },
});
