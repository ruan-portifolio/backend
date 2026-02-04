import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateTenantUser1684512000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tenant_user',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'provider', type: 'varchar', length: '80', isNullable: true },
          { name: 'provider_id', type: 'varchar', length: '128', isNullable: true },
          { name: 'email', type: 'varchar', length: '255', isNullable: true },
          { name: 'name', type: 'varchar', length: '255', isNullable: true },
          { name: 'avatar_url', type: 'text', isNullable: true },
          { name: 'status', type: 'boolean', default: false },
          { name: 'plano', type: 'varchar', length: '80', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'tenant_user',
      new TableIndex({ name: 'IDX_TENANT_USER_PROVIDER', columnNames: ['provider', 'provider_id'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('tenant_user', 'IDX_TENANT_USER_PROVIDER');
    await queryRunner.dropTable('tenant_user');
  }
}
