import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Director } from '../directors/entities/director.entity';
import { Movie } from '../movies/entities/movie.entity';
import { DIRECTORS_SEED } from './seed-data';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const dataSource = app.get(DataSource);
  const directorsRepository = dataSource.getRepository(Director);
  const moviesRepository = dataSource.getRepository(Movie);

  await moviesRepository.createQueryBuilder().delete().execute();
  await directorsRepository.createQueryBuilder().delete().execute();

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

  console.log(
    `Seeded ${DIRECTORS_SEED.length} directors and ${moviesCount} movies.`,
  );

  await app.close();
}

void seed();
