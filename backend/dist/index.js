"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app_1 = __importDefault(require("./app"));
const prisma_client_1 = require("./database/prisma.client");
const pos_invoice_accounts_bootstrap_1 = require("./database/pos-invoice-accounts.bootstrap");
const env_1 = require("./config/env");
async function bootstrap() {
    try {
        await prisma_client_1.prisma.$connect();
        console.log("Database connected");
        await (0, pos_invoice_accounts_bootstrap_1.ensurePosInvoiceAccountsTable)();
        app_1.default.listen(env_1.env.PORT, () => {
            console.log(`Backend running on http://localhost:${env_1.env.PORT}`);
        });
    }
    catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
}
bootstrap();
