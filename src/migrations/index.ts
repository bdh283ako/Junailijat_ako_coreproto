import * as migration_20261125_180136_initial_postgres_schema from './20261125_180136_initial_postgres_schema';
import * as migration_20261127_140000_users_email_unique from './20261127_140000_users_email_unique';

export const migrations = [
  {
    up: migration_20261125_180136_initial_postgres_schema.up,
    down: migration_20261125_180136_initial_postgres_schema.down,
    name: '20261125_180136_initial_postgres_schema'
  },
  {
    up: migration_20261127_140000_users_email_unique.up,
    down: migration_20261127_140000_users_email_unique.down,
    name: '20261127_140000_users_email_unique'
  },
];
