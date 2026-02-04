import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingCycleEndToTenantUser1769164126787 implements MigrationInterface {
  name = 'AddBillingCycleEndToTenantUser1769164126787';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_user" ADD "billingCycleEnd" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_user" DROP COLUMN "billingCycleEnd"`,
    );
  }
}
