ALTER TABLE "inventory_products" ADD COLUMN "isHardLiquor" BOOLEAN NOT NULL DEFAULT false;

-- Existing products: hard liquor by their category, as the limit worked until now
-- (the categories chosen in Shop Settings, or else spirits by category name; beer never).
UPDATE "inventory_products" p SET "isHardLiquor" = true
FROM "inventory_categories" c
WHERE c."id" = p."categoryId"
  AND (
    CASE
      WHEN jsonb_typeof((SELECT "value"::jsonb -> 'hardLiquorCategoryIds' FROM "pos_settings" WHERE "key" = 'shop')) = 'array'
        THEN (SELECT "value"::jsonb -> 'hardLiquorCategoryIds' FROM "pos_settings" WHERE "key" = 'shop') @> to_jsonb(c."id")
      ELSE c."name" ~* '(arrack|wh?isk|brandy|\mrum\M|\mgin\M|vodka|liqu|tequila|cognac|spirit|scotch|bourbon)'
    END
  );
