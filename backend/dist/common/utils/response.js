"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
exports.sendCreated = sendCreated;
function sendSuccess(res, data, statusCode = 200) {
    return res.status(statusCode).json({ success: true, data });
}
function sendError(res, message, statusCode = 400, errors) {
    return res.status(statusCode).json({ success: false, message, ...(errors ? { errors } : {}) });
}
function sendCreated(res, data) {
    return sendSuccess(res, data, 201);
}
