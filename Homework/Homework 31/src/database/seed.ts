import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { addMonths } from '../common/utils/date.util';
import { Director } from '../directors/entities/director.entity';
import { Movie } from '../movies/entities/movie.entity';
import { ProductPhoto } from '../products/entities/product-photo.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import {
  DIRECTORS_SEED,
  PRODUCTS_SEED,
  SEED_USER_PASSWORD,
  USERS_SEED,
} from './seed-data';

const PASSWORD_SALT_ROUNDS = 10;
const SUBSCRIPTION_DURATION_MONTHS = 1;

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const dataSource = app.get(DataSource);

  const directorsRepository = dataSource.getRepository(Director);
  const moviesRepository = dataSource.getRepository(Movie);
  const usersRepository = dataSource.getRepository(User);
  const productsRepository = dataSource.getRepository(Product);
  const productPhotosRepository = dataSource.getRepository(ProductPhoto);

  // Children before parents, so foreign keys don't block the delete.
  await moviesRepository.createQueryBuilder().delete().execute();
  await directorsRepository.createQueryBuilder().delete().execute();
  await productPhotosRepository.createQueryBuilder().delete().execute();
  await productsRepository.createQueryBuilder().delete().execute();
  await usersRepository.createQueryBuilder().delete().execute();

  let moviesCount = 0;

  for (const { films, ...directorData } of DIRECTORS_SEED) {
    const director = await directorsRepository.save(
      directorsRepository.create(directorData),
    );

    await moviesRepository.save(
      films.map((film) => moviesRepository.create({ ...film, director })),
    );
    moviesCount += films.length;
  }

  // Mirrors what AuthService.register() does for a real signup: hash the
  // password and open a fresh subscription window, so a seeded user is
  // indistinguishable from one who just registered.
  const subscriptionStartDate = new Date();
  const subscriptionEndDate = addMonths(
    subscriptionStartDate,
    SUBSCRIPTION_DURATION_MONTHS,
  );

  for (const { password, ...userData } of USERS_SEED) {
    const hashedPassword = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

    await usersRepository.save(
      usersRepository.create({
        ...userData,
        password: hashedPassword,
        subscriptionStartDate,
        subscriptionEndDate,
      }),
    );
  }

  await productsRepository.save(
    PRODUCTS_SEED.map((product) => productsRepository.create(product)),
  );

  console.log(
    `Seeded ${DIRECTORS_SEED.length} directors, ${moviesCount} movies, ${USERS_SEED.length} users, and ${PRODUCTS_SEED.length} products.`,
  );
  console.log(
    `Every seeded user shares the password "${SEED_USER_PASSWORD}" — ` +
      `try POST /auth/login with { "email": "${USERS_SEED[0].email}", "password": "${SEED_USER_PASSWORD}" }.`,
  );
  console.log(
    'No product or profile photos are seeded — upload real ones through the API to exercise the S3/CloudFront flow.',
  );

  await app.close();
}

void seed();
