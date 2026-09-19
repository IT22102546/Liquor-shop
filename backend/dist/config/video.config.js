"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoConfig = void 0;
const config_1 = require("@nestjs/config");
const common_1 = require("@nestjs/common");
const logger = new common_1.Logger("VideoConfig");
exports.VideoConfig = (0, config_1.registerAs)("video", () => {
    const jitsiDomain = process.env.JITSI_DOMAIN || "localhost:8443";
    const jitsiAppId = process.env.JITSI_APP_ID || "";
    const jitsiApiSecret = process.env.JITSI_API_SECRET || "";
    const useJwtAuth = process.env.JITSI_USE_JWT === "true" && jitsiAppId && jitsiApiSecret;
    if (useJwtAuth) {
        logger.log("Jitsi configured with JWT authentication");
    }
    else {
        logger.log(`Jitsi configured for self-hosted mode without JWT at domain: ${jitsiDomain}`);
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
