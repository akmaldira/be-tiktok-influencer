const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Migration1712986492381 {
    name = 'Migration1712986492381'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "tbl_campaign" ALTER COLUMN "country" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tbl_campaign" ALTER COLUMN "category" DROP NOT NULL`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "tbl_campaign" ALTER COLUMN "category" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tbl_campaign" ALTER COLUMN "country" SET NOT NULL`);
    }
}
