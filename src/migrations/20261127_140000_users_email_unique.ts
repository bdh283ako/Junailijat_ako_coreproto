import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Uniikki email käyttäjille (osittainen indeksi: NULL-arvot sallittu monta kertaa).
 * Email normalisoidaan aina pieniksi kirjaimiksi (Users.beforeValidate + auth-synkronointi),
 * joten tavallinen uniikki indeksi riittää.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique_idx" ON "public"."users" USING btree ("email") WHERE "email" IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "public"."users_email_unique_idx";
  `)
}
