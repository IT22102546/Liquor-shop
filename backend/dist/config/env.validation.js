"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envConfig = void 0;
exports.validateEnvironment = validateEnvironment;
const common_1 = require("@nestjs/common");
const logger = new common_1.Logger("EnvValidation");
function validateEnvironment() {
    const errors = [];
    const warnings = [];
    const addError = (key, message) => {
        errors.push({ key, message, severity: "error" });
    };
    const addWarning = (key, message) => {
        warnings.push({ key, message, severity: "warning" });
    };
    if (!process.env.DATABASE_URL) {
        addError("DATABASE_URL", "DATABASE_URL is required");
    }
    if (!process.env.DB_PASSWORD) {
        addError("DB_PASSWORD", "DB_PASSWORD is required");
    }
    else if (process.env.DB_PASSWORD.length < 8) {
        addError("DB_PASSWORD", "DB_PASSWORD must be at least 8 characters");
    }
    else if (process.env.DB_PASSWORD === "password" ||
        process.env.DB_PASSWORD === "postgres" ||
        process.env.DB_PASSWORD === "123456") {
        addError("DB_PASSWORD", "DB_PASSWORD is using a common/weak password");
    }
    if (!process.env.JWT_SECRET) {
        addError("JWT_SECRET", "JWT_SECRET is required");
    }
    else {
        const jwtSecret = process.env.JWT_SECRET;
        if (jwtSecret.length < 32) {
            addError("JWT_SECRET", `JWT_SECRET must be at least 32 characters (current: ${jwtSecret.length})`);
        }
        const placeholderPatterns = [
            "change",
            "example",
            "your-",
            "super-secure",
            "CHANGE_ME",
            "TODO",
            "xxx",
            "secret-key",
        ];
        if (placeholderPatterns.some((pattern) => jwtSecret.toLowerCase().includes(pattern.toLowerCase()))) {
            addError("JWT_SECRET", "JWT_SECRET contains placeholder text. Generate a real secret using: node scripts/generate-secrets.js");
        }
        if (jwtSecret === jwtSecret.toLowerCase() ||
            jwtSecret === jwtSecret.toUpperCase()) {
            addWarning("JWT_SECRET", "JWT_SECRET should contain mixed case for better entropy");
        }
    }
    if (!process.env.JWT_REFRESH_SECRET) {
        addError("JWT_REFRESH_SECRET", "JWT_REFRESH_SECRET is required");
    }
    else {
        const refreshSecret = process.env.JWT_REFRESH_SECRET;
        if (refreshSecret.length < 32) {
            addError("JWT_REFRESH_SECRET", `JWT_REFRESH_SECRET must be at least 32 characters (current: ${refreshSecret.length})`);
        }
        const placeholderPatterns = [
            "change",
            "example",
            "your-",
            "super-secure",
            "CHANGE_ME",
            "TODO",
            "xxx",
            "secret-key",
        ];
        if (placeholderPatterns.some((pattern) => refreshSecret.toLowerCase().includes(pattern.toLowerCase()))) {
            addError("JWT_REFRESH_SECRET", "JWT_REFRESH_SECRET contains placeholder text. Generate a real secret using: node scripts/generate-secrets.js");
        }
    }
    if (process.env.JWT_SECRET &&
        process.env.JWT_REFRESH_SECRET &&
        process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
        addError("JWT_SECRET", "JWT_SECRET and JWT_REFRESH_SECRET must be different for security");
    }
    if (!process.env.SESSION_SECRET) {
        addError("SESSION_SECRET", "SESSION_SECRET is required");
    }
    else if (process.env.SESSION_SECRET.length < 32) {
        addError("SESSION_SECRET", `SESSION_SECRET must be at least 32 characters (current: ${process.env.SESSION_SECRET.length})`);
    }
    const validNodeEnvs = ["development", "production", "test"];
    if (!process.env.NODE_ENV) {
        addWarning("NODE_ENV", "NODE_ENV not set, defaulting to development");
    }
    else if (!validNodeEnvs.includes(process.env.NODE_ENV)) {
        addError("NODE_ENV", `NODE_ENV must be one of: ${validNodeEnvs.join(", ")} (current: ${process.env.NODE_ENV})`);
    }
    if (process.env.NODE_ENV === "production") {
        if (process.env.API_BASE_URL &&
            !process.env.API_BASE_URL.startsWith("https://")) {
            addError("API_BASE_URL", "API_BASE_URL must use HTTPS in production");
        }
        if (process.env.FRONTEND_URL &&
            !process.env.FRONTEND_URL.startsWith("https://")) {
            addError("FRONTEND_URL", "FRONTEND_URL must use HTTPS in production");
        }
        if (process.env.ALLOWED_ORIGINS &&
            process.env.ALLOWED_ORIGINS.includes("localhost")) {
            addWarning("ALLOWED_ORIGINS", "ALLOWED_ORIGINS contains localhost in production environment");
        }
        if (!process.env.REDIS_PASSWORD) {
            addWarning("REDIS_PASSWORD", "REDIS_PASSWORD should be set in production");
        }
    }
    if (!process.env.ALLOWED_ORIGINS) {
        addWarning("ALLOWED_ORIGINS", "ALLOWED_ORIGINS not set, CORS may be too permissive");
    }
    if (process.env.BCRYPT_SALT_ROUNDS) {
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10);
        if (isNaN(saltRounds) || saltRounds < 10 || saltRounds > 15) {
            addError("BCRYPT_SALT_ROUNDS", "BCRYPT_SALT_ROUNDS must be between 10 and 15");
        }
    }
    if (process.env.PORT) {
        const port = parseInt(process.env.PORT, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
            addError("PORT", "PORT must be a valid port number (1-65535)");
        }
    }
    if (warnings.length > 0) {
        logger.warn("\n⚠️  Environment Configuration Warnings:");
        warnings.forEach((warning) => {
            logger.warn(`   ${warning.key}: ${warning.message}`);
        });
        logger.warn("");
    }
    if (errors.length > 0) {
        logger.error("\n❌ Environment Configuration Errors:");
        errors.forEach((error) => {
            logger.error(`   ${error.key}: ${error.message}`);
        });
        logger.error("\n🔧 To fix these issues:");
        logger.error("   1. Copy .env.example to .env if you haven't");
        logger.error("   2. Run: node scripts/generate-secrets.js");
        logger.error("   3. Update .env with the generated secrets");
        logger.error("   4. Replace all placeholder values\n");
        throw new Error(`Environment validation failed with ${errors.length} error(s). Fix the issues above and restart the application.`);
    }
    logger.log("✅ Environment configuration validated successfully");
}
exports.envConfig = {
    nodeEnv: process.env.NODE_ENV || "development",
    port: parseInt(process.env.PORT || "5000", 10),
    apiBaseUrl: process.env.API_BASE_URL,
    frontendUrl: process.env.FRONTEND_URL,
    database: {
        url: process.env.DATABASE_URL,
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        username: process.env.DB_USERNAME || "postgres",
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || "jlracing_db",
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || "1h",
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    },
    redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        password: process.env.REDIS_PASSWORD,
    },
    security: {
        bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10),
        sessionSecret: process.env.SESSION_SECRET,
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [],
    },
    isProduction: process.env.NODE_ENV === "production",
    isDevelopment: process.env.NODE_ENV === "development",
    isTest: process.env.NODE_ENV === "test",
};
