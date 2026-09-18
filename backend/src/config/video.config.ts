import { registerAs } from "@nestjs/config";
import { Logger } from "@nestjs/common";

const logger = new Logger("VideoConfig");

export const VideoConfig = registerAs("video", () => {
  // Self-hosted Jitsi domain (localhost:8443 for development, configure for production)
  const jitsiDomain = process.env.JITSI_DOMAIN || "localhost:8443";

  // Optional: Use JWT auth for self-hosted Jitsi with token authentication enabled
  // Leave these empty if your self-hosted Jitsi doesn't require JWT
  const jitsiAppId = process.env.JITSI_APP_ID || "";
  const jitsiApiSecret = process.env.JITSI_API_SECRET || "";

  // Whether to use JWT authentication (only needed if your self-hosted Jitsi has token auth enabled)
  const useJwtAuth =
    process.env.JITSI_USE_JWT === "true" && jitsiAppId && jitsiApiSecret;

  if (useJwtAuth) {
    logger.log("Jitsi configured with JWT authentication");
  } else {
    logger.log(
      `Jitsi configured for self-hosted mode without JWT at domain: ${jitsiDomain}`
    );
  }

  return {
    jitsi: {
      domain: jitsiDomain,
      appId: jitsiAppId,
      apiSecret: jitsiApiSecret,
      useJwtAuth,
    },
  };
});
