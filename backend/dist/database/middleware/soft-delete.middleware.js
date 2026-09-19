"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSoftDeleteMiddleware = createSoftDeleteMiddleware;
exports.bypassSoftDelete = bypassSoftDelete;
const SOFT_DELETE_MODELS = [
    "User",
    "Class",
    "Enrollment",
    "Exam",
    "ExamAttempt",
    "Publication",
    "CourseMaterial",
    "Payment",
    "TransferRequest",
    "Announcement",
    "Notification",
];
function supportsSoftDelete(modelName) {
    return SOFT_DELETE_MODELS.includes(modelName);
}
function createSoftDeleteMiddleware() {
    return async (params, next) => {
        const { model, action } = params;
        if (!model || !supportsSoftDelete(model)) {
            return next(params);
        }
        switch (action) {
            case "findUnique":
            case "findFirst": {
                params.action = "findFirst";
                params.args.where = {
                    ...params.args.where,
                    deletedAt: null,
                };
                break;
            }
            case "findMany": {
                if (!params.args.where?.deletedAt) {
                    params.args.where = {
                        ...params.args.where,
                        deletedAt: null,
                    };
                }
                break;
            }
            case "count": {
                if (!params.args.where?.deletedAt) {
                    params.args.where = {
                        ...params.args.where,
                        deletedAt: null,
                    };
                }
                break;
            }
            case "update": {
                params.action = "updateMany";
                params.args.where = {
                    ...params.args.where,
                    deletedAt: null,
                };
                break;
            }
            case "updateMany": {
                if (!params.args.where?.deletedAt) {
                    params.args.where = {
                        ...params.args.where,
                        deletedAt: null,
                    };
                }
                break;
            }
            case "delete": {
                params.action = "update";
                params.args.data = {
                    deletedAt: new Date(),
                };
                break;
            }
            case "deleteMany": {
                params.action = "updateMany";
                if (!params.args.data) {
                    params.args.data = {};
                }
                params.args.data.deletedAt = new Date();
                break;
            }
        }
        return next(params);
    };
}
function bypassSoftDelete(where) {
    return {
        ...where,
        OR: [{ deletedAt: null }, { deletedAt: { not: null } }],
    };
}
