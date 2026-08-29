WITH ranked AS (
  SELECT
    id,
    "establishmentId",
    ROW_NUMBER() OVER (PARTITION BY "establishmentId" ORDER BY "order" ASC, id ASC) - 1 AS new_order
  FROM "Category"
)
UPDATE "Category" c
SET "order" = r.new_order
FROM ranked r
WHERE c.id = r.id
  AND c."order" != r.new_order;
