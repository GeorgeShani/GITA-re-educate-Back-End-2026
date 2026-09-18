import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('GraphQL API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a user, logs in, and rejects unauthenticated post access', async () => {
    const email = `user-${Date.now()}@example.com`;
    const firstName = 'Jane';
    const lastName = 'Doe';
    const password = 'password123';

    const registerResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
              accessToken
              user { id email firstName lastName }
            }
          }
        `,
        variables: { input: { email, firstName, lastName, password } },
      })
      .expect(200);

    const accessToken = registerResponse.body.data.register.accessToken as string;
    expect(accessToken).toBeTruthy();
    expect(registerResponse.body.data.register.user.email).toBe(email);

    const unauthenticatedResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: `query { posts { id } }` })
      .expect(200);

    expect(unauthenticatedResponse.body.errors).toBeTruthy();

    const authenticatedResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        query: `
          mutation CreatePost($input: CreatePostInput!) {
            createPost(input: $input) { id title content authorId }
          }
        `,
        variables: { input: { title: 'Hello world', content: 'My first post' } },
      })
      .expect(200);

    expect(authenticatedResponse.body.data.createPost.title).toBe('Hello world');
  });
});
