import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

const STATUS_ENUMS = [
  "user_availability_status_enum",
  "availability_event_status_enum",
  "daily_status_check_confirmedstatus_enum",
] as const;

const NEW_STATUS_VALUES = [
  "OFFICE",
  "REMOTE",
  "SICK_DAY",
  "SICK_LIST",
  "VACATION",
  "UNKNOWN",
] as const;

@Injectable()
export class AvailabilityStatusMigrationService implements OnModuleInit {
  private readonly logger = new Logger(AvailabilityStatusMigrationService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit() {
    const alreadyMigrated = await this.hasEnumValue(
      "user_availability_status_enum",
      "OFFICE"
    );

    if (alreadyMigrated) {
      return;
    }

    this.logger.log("Migrating availability status enum values...");
    await this.migrateAvailabilityStatuses();
    this.logger.log("Availability status enum migration complete.");
  }

  private async hasEnumValue(typeName: string, value: string) {
    const rows = await this.dataSource.query(
      `
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = $1 AND e.enumlabel = $2
        LIMIT 1
      `,
      [typeName, value]
    );

    return rows.length > 0;
  }

  private async migrateAvailabilityStatuses() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const enumName of STATUS_ENUMS) {
        await this.migrateEnumType(queryRunner, enumName);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error("Availability status enum migration failed", error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async migrateEnumType(
    queryRunner: ReturnType<DataSource["createQueryRunner"]>,
    enumName: string
  ) {
    const newEnumName = `${enumName}_new`;
    const newValuesSql = NEW_STATUS_VALUES.map((value) => `'${value}'`).join(", ");

    await queryRunner.query(`CREATE TYPE "${newEnumName}" AS ENUM (${newValuesSql})`);

    const tables = await this.getTablesUsingEnum(queryRunner, enumName);

    for (const { tableName, columnName, hasDefault } of tables) {
      if (hasDefault) {
        await queryRunner.query(
          `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" DROP DEFAULT`
        );
      }

      await queryRunner.query(`
        ALTER TABLE "${tableName}"
        ALTER COLUMN "${columnName}" TYPE "${newEnumName}"
        USING (
          CASE "${columnName}"::text
            WHEN 'ON_SHIFT' THEN 'OFFICE'
            WHEN 'OFF_SHIFT' THEN 'REMOTE'
            WHEN 'SICK' THEN 'SICK_DAY'
            WHEN 'VACATION' THEN 'VACATION'
            WHEN 'UNKNOWN' THEN 'UNKNOWN'
            ELSE 'UNKNOWN'
          END::"${newEnumName}"
        )
      `);

      if (hasDefault) {
        await queryRunner.query(
          `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET DEFAULT 'UNKNOWN'::"${newEnumName}"`
        );
      }
    }

    await queryRunner.query(`DROP TYPE "${enumName}"`);
    await queryRunner.query(`ALTER TYPE "${newEnumName}" RENAME TO "${enumName}"`);
  }

  private async getTablesUsingEnum(
    queryRunner: ReturnType<DataSource["createQueryRunner"]>,
    enumName: string
  ) {
    const rows: Array<{ table_name: string; column_name: string; column_default: string | null }> =
      await queryRunner.query(
        `
          SELECT table_name, column_name, column_default
          FROM information_schema.columns
          WHERE udt_name = $1
        `,
        [enumName]
      );

    return rows.map((row) => ({
      tableName: row.table_name,
      columnName: row.column_name,
      hasDefault: Boolean(row.column_default),
    }));
  }
}
