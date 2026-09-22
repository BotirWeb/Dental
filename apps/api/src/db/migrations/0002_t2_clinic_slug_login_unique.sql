DROP INDEX IF EXISTS "users_login_unique";--> statement-breakpoint
-- T2: bundan buyon login saqlashda har doim trim+lowercase (routes/auth.ts).
-- Mavjud qatorlar ham shu shaklga keltiriladi — aks holda "Owner" va "owner"
-- ikkalasi bazada qolib, keyingi CREATE UNIQUE INDEX to'qnashuvda XATO bilan
-- to'xtaydi (ataylab — bu holatda qo'lda hal qilinishi kerak, jimgina
-- birlashtirilmaydi).
UPDATE "users" SET "login" = lower(trim("login"));--> statement-breakpoint
-- T2 (tahlil C4): avval NULLABLE qo'shiladi, mavjud qatorlarga vaqtinchalik
-- slug beriladi ("clinic1", "clinic2", ...), keyin NOT NULL qilinadi — buni
-- bitta ADD COLUMN ... NOT NULL qadamida (defaultsiz) bo'lib bo'lmaydi, chunki
-- jadvalda allaqachon qator bo'lishi mumkin (masalan seed'dagi "Namuna Klinika").
ALTER TABLE "clinics" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "clinics" AS c SET "slug" = 'clinic' || sub.rn
FROM (SELECT "id", row_number() OVER (ORDER BY "created_at") AS rn FROM "clinics") AS sub
WHERE c."id" = sub."id" AND c."slug" IS NULL;--> statement-breakpoint
ALTER TABLE "clinics" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clinics_slug_unique" ON "clinics" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_login_unique" ON "users" USING btree ("clinic_id","login") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_slug_format" CHECK ("clinics"."slug" ~ '^[a-z0-9-]{3,32}$');