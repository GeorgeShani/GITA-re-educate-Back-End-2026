import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from './app.module.js';
import { Post } from './posts/schemas/post.schema.js';
import type { PostDocument } from './posts/schemas/post.schema.js';
import { UsersService } from './users/users.service.js';

interface SeedUser {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

interface SeedPost {
  title: string;
  content: string;
  authorEmail: string;
}

const seedUsers: SeedUser[] = [
  { email: 'jane.doe@example.com', firstName: 'Jane', lastName: 'Doe', password: 'password123' },
  { email: 'john.smith@example.com', firstName: 'John', lastName: 'Smith', password: 'password123' },
];

const seedPosts: SeedPost[] = [
  {
    title: 'Welcome to the platform',
    content: 'This is the first seeded post.',
    authorEmail: 'jane.doe@example.com',
  },
  {
    title: 'GraphQL is great',
    content: 'Building APIs with GraphQL and NestJS is a breeze.',
    authorEmail: 'jane.doe@example.com',
  },
  {
    title: 'Hello from John',
    content: 'Just saying hi to everyone on the platform!',
    authorEmail: 'john.smith@example.com',
  },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const postModel = app.get<Model<PostDocument>>(getModelToken(Post.name));

  const authorIdByEmail = new Map<string, string>();

  for (const seedUser of seedUsers) {
    const existing = await usersService.findByEmail(seedUser.email);
    const user = existing ?? (await usersService.create(seedUser));
    authorIdByEmail.set(seedUser.email, user._id.toString());
  }

  let createdPosts = 0;

  for (const seedPost of seedPosts) {
    const authorId = authorIdByEmail.get(seedPost.authorEmail);

    if (!authorId) {
      continue;
    }

    const existingPost = await postModel.findOne({ title: seedPost.title, author: authorId }).exec();

    if (existingPost) {
      continue;
    }

    await postModel.create({ title: seedPost.title, content: seedPost.content, author: authorId });
    createdPosts += 1;
  }

  console.log(`Seed complete: ${authorIdByEmail.size} user(s) ensured, ${createdPosts} new post(s) created.`);

  await app.close();
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
