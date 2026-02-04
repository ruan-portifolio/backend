import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateStripePaymentOrdersEntity1769067263006 implements MigrationInterface {
    name = 'CreateStripePaymentOrdersEntity1769067263006'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_TENANT_USER_PROVIDER"`);
        await queryRunner.query(`CREATE TABLE "stripe_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "checkoutSessionId" character varying NOT NULL, "userId" character varying NOT NULL, "subscriptionId" character varying NOT NULL, "invoiceId" character varying NOT NULL, "amountTotal" integer NOT NULL, "currency" character varying NOT NULL, "currentPeriodEnd" TIMESTAMP WITH TIME ZONE NOT NULL, "paymentStatus" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_73c5f2bab2e4c6f341c30bf6bad" UNIQUE ("checkoutSessionId"), CONSTRAINT "PK_1f1488e4700ddd993ba5dad0517" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "stripe_orders"`);
        await queryRunner.query(`CREATE INDEX "IDX_TENANT_USER_PROVIDER" ON "tenant_user" ("provider", "provider_id") `);
    }

}
