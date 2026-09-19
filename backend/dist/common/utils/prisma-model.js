"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prismaModelHasObjectField = prismaModelHasObjectField;
const prisma_1 = require("../../generated/prisma");
function getPrismaModelFields(db, modelName) {
    const runtimeFields = db?._runtimeDataModel?.models?.[modelName]?.fields;
    if (Array.isArray(runtimeFields))
        return runtimeFields;
    const dmmfFields = prisma_1.Prisma.dmmf?.datamodel?.models?.find((model) => model.name === modelName)?.fields;
    return Array.isArray(dmmfFields) ? dmmfFields : [];
}
function prismaModelHasObjectField(db, modelName, fieldName) {
    return getPrismaModelFields(db, modelName).some((field) => field?.name === fieldName && field?.kind === "object");
}
