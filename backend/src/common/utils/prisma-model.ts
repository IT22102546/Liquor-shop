import { Prisma } from "../../generated/prisma";

function getPrismaModelFields(db: any, modelName: string): any[] {
  const runtimeFields = db?._runtimeDataModel?.models?.[modelName]?.fields;
  if (Array.isArray(runtimeFields)) return runtimeFields;

  const dmmfFields = (Prisma as any).dmmf?.datamodel?.models?.find(
    (model: any) => model.name === modelName,
  )?.fields;
  return Array.isArray(dmmfFields) ? dmmfFields : [];
}

export function prismaModelHasObjectField(
  db: any,
  modelName: string,
  fieldName: string,
) {
  return getPrismaModelFields(db, modelName).some(
    (field: any) => field?.name === fieldName && field?.kind === "object",
  );
}
