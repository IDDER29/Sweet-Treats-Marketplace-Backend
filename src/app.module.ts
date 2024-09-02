import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module'; // Import your Users module

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'your_db_username',
      password: 'mypassword@',
      database: 'Sweet-Treats-Marketplace-DB',
      autoLoadEntities: true,
      synchronize: true, // Set to false in production
    }),
    UsersModule, // Add the Users module here
  ],
})
export class AppModule {}
