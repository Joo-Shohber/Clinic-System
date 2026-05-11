import dotenv from "dotenv";
dotenv.config();

import http from "http";
import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { connectRedis, disconnectRedis } from "./config/redis";
import { getEnv } from "./config/env";
import { logger } from "./config/logger";
import { initWebSocket } from "./services/websocket.service";
import { startExpirationWorker } from "./workers/expiration.worker";
import { startNotificationWorker } from "./workers/notification.worker";

async function bootstrap() {
  const env = getEnv();
  const PORT = env.PORT;

  // Connect to databases
  await connectDatabase();
  await connectRedis();

  // Create Express app
  const app = createApp();
  const httpServer = http.createServer(app);

  // Init WebSocket
  initWebSocket(httpServer);

  // Start BullMQ workers
  const expirationWorker = startExpirationWorker();
  const notificationWorker = startNotificationWorker();

  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });

  // ===== Graceful Shutdown =====
  async function shutdown(signal: string) {
    logger.info(`${signal} received — shutting down gracefully`);

    // Stop accepting new connections
    httpServer.close(async () => {
      logger.info("HTTP server closed");

      try {
        // Close workers
        await expirationWorker.close();
        await notificationWorker.close();
        logger.info("Workers closed");

        // Disconnect databases
        await disconnectDatabase();
        await disconnectRedis();
        logger.info("Databases disconnected");

        process.exit(0);
      } catch (err) {
        logger.error({ err }, "Error during shutdown");
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Handle unhandled rejections
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled rejection");
    void shutdown("unhandledRejection");
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
