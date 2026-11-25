import * as migration_20261125_180136_initial_postgres_schema from './20261125_180136_initial_postgres_schema';

export const migrations = [
  {
    up: migration_20261125_180136_initial_postgres_schema.up,
    down: migration_20261125_180136_initial_postgres_schema.down,
    name: '20261125_180136_initial_postgres_schema'
  },
];
