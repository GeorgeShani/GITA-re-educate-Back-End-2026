// A hand-written HTML docs page, not generated from an OpenAPI spec — kept
// as a plain JS string (not a static file under public/) so it's guaranteed
// to be part of the serverless function's bundle regardless of environment;
// Vercel's zero-config Express hosting ignores express.static()/public/**
// for anything served through the app itself, and a runtime fs.readFile of
// a separate .html file risks being pruned by the bundler's file trace since
// nothing `import`s/`require`s it directly. Update this by hand alongside
// constants/*.js and the models/validations whenever the API shape changes —
// there's no automatic sync.
export const API_DOCS_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Mood Tracker API</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Reddit+Sans:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
<style>
  :root {
    --blue-600: #4865db;
    --neutral-900: #21214d;
    --neutral-600: #57577b;
    --neutral-300: #9393b7;
    --blue-100: #e0e6fa;
    --green: #2f9e44;
    --amber: #e8590c;
    --red: #e03131;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Reddit Sans", ui-sans-serif, system-ui, sans-serif;
    color: var(--neutral-900);
    background: linear-gradient(180deg, #f5f5ff 0%, #e0e0ff 100%);
    line-height: 1.5;
  }
  .container { max-width: 880px; margin: 0 auto; padding: 48px 24px 96px; }
  header { display: flex; flex-direction: column; gap: 8px; margin-bottom: 40px; }
  header .title-row { display: flex; align-items: center; gap: 16px; }
  header .logo { flex-shrink: 0; width: 40px; height: 40px; }
  header h1 { font-size: 32px; font-weight: 700; margin: 0; letter-spacing: -0.3px; }
  header p { font-size: 16px; color: var(--neutral-600); margin: 0; }
  section { margin-bottom: 40px; }
  section > h2 {
    font-size: 20px;
    border-bottom: 1px solid var(--blue-100);
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .card {
    background: #fff;
    border: 1px solid var(--blue-100);
    border-radius: 16px;
    padding: 20px 24px;
    margin-bottom: 16px;
  }
  .card h3 { margin: 0 0 12px; font-size: 16px; }
  .endpoint-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
  .badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.3px;
    padding: 3px 8px;
    border-radius: 6px;
    text-transform: uppercase;
    color: #fff;
  }
  .badge.get { background: var(--green); }
  .badge.post { background: var(--blue-600); }
  .badge.patch { background: var(--amber); }
  .lock { font-size: 13px; color: var(--neutral-600); }
  .path { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 14px; font-weight: 600; }
  .desc { color: var(--neutral-600); font-size: 14px; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 4px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--blue-100); vertical-align: top; }
  table.endpoint-table th { width: 90px; color: var(--neutral-600); font-weight: 600; }
  table.schema-table th { color: var(--neutral-600); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; }
  code { font-family: ui-monospace, "SF Mono", Menlo, monospace; background: var(--blue-100); padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  .enum-list code { margin: 2px 4px 2px 0; display: inline-block; }
  .required { color: var(--red); font-weight: 700; font-size: 11px; }
  footer { text-align: center; color: var(--neutral-300); font-size: 13px; margin-top: 64px; }
  a { color: var(--blue-600); }
</style>
</head>
<body>
<div class="container">

  <header>
    <div class="title-row">
      <svg class="logo" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none">
        <path d="M0 20C0 10.5719 0 5.85786 2.92893 2.92893C5.85786 0 10.5719 0 20 0C29.4281 0 34.1421 0 37.0711 2.92893C40 5.85786 40 10.5719 40 20C40 29.4281 40 34.1421 37.0711 37.0711C34.1421 40 29.4281 40 20 40C10.5719 40 5.85786 40 2.92893 37.0711C0 34.1421 0 29.4281 0 20Z" fill="#4865DB"/>
        <path d="M23.9999 26C24.5522 26 25.01 26.4521 24.9003 26.9934C24.7064 27.9494 24.2354 28.8355 23.5354 29.5355C22.5978 30.4732 21.326 31 19.9999 31C18.6738 31 17.4021 30.4732 16.4644 29.5355C15.7644 28.8355 15.2934 27.9494 15.0996 26.9934C14.9898 26.4521 15.4476 26 15.9999 26H23.9999Z" fill="white"/>
        <path d="M26.1022 17.7765C25.5687 17.9194 25.242 18.4775 25.5125 18.959C25.7972 19.4658 26.191 19.9081 26.6701 20.2514C27.4223 20.7904 28.3381 21.052 29.2616 20.9914C30.185 20.9309 31.0589 20.5521 31.7343 19.9195C32.4098 19.2869 32.8449 18.4396 32.9657 17.5221C33.0865 16.6046 32.8855 15.6736 32.3968 14.8877C31.9081 14.1019 31.162 13.5098 30.2857 13.2123C29.4094 12.9148 28.4571 12.9304 27.591 13.2564C27.0394 13.464 26.5446 13.7893 26.1384 14.2051C25.7525 14.6002 25.9236 15.2239 26.4019 15.5L26.9092 15.7929C27.6807 16.2384 27.5286 17.3943 26.668 17.6249L26.1022 17.7765Z" fill="white"/>
        <path d="M13.8977 17.7765C14.4312 17.9194 14.7579 18.4775 14.4874 18.959C14.2027 19.4658 13.8089 19.9081 13.3299 20.2514C12.5777 20.7904 11.6618 21.052 10.7384 20.9914C9.81496 20.9309 8.94107 20.5521 8.26564 19.9195C7.59021 19.2869 7.15502 18.4396 7.03423 17.5221C6.91344 16.6046 7.11451 15.6736 7.6032 14.8877C8.09188 14.1019 8.83794 13.5098 9.71425 13.2123C10.5905 12.9148 11.5429 12.9304 12.409 13.2564C12.9605 13.464 13.4554 13.7893 13.8616 14.2051C14.2475 14.6002 14.0763 15.2239 13.598 15.5L13.0907 15.7929C12.3192 16.2384 12.4714 17.3943 13.3319 17.6249L13.8977 17.7765Z" fill="white"/>
      </svg>
      <h1>Mood Tracker API</h1>
    </div>
    <div>
      <p>Express + MongoDB API for auth, profile/avatar management, and daily mood check-ins.</p>
    </div>
  </header>

  <section>
    <h2>Auth</h2>
    <p class="desc">
      Stateless Bearer JWT, no cookies or server-side session. Send
      <code>Authorization: Bearer &lt;token&gt;</code> on every 🔒 endpoint below.
      Tokens come from <code>/auth/sign-up</code> or <code>/auth/sign-in</code> and expire after 7 days.
      Every error response is <code>{ "message": "..." }</code>.
    </p>
  </section>

  <section>
    <h2>Schemas</h2>

    <div class="card">
      <h3>User</h3>
      <table class="schema-table">
        <thead><tr><th>Field</th><th>Type</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td><code>id</code></td><td>ObjectId</td><td></td></tr>
          <tr><td><code>email</code></td><td>string</td><td><span class="required">required</span>, unique</td></tr>
          <tr><td><code>name</code></td><td>string</td><td>default <code>""</code></td></tr>
          <tr><td><code>avatarUrl</code></td><td>string | null</td><td>Cloudinary secure_url</td></tr>
          <tr><td><code>hasOnboarded</code></td><td>boolean</td><td>default <code>false</code></td></tr>
          <tr><td><code>createdAt</code>, <code>updatedAt</code></td><td>date</td><td></td></tr>
        </tbody>
      </table>
      <p class="desc"><code>password</code> and <code>avatarPublicId</code> are stored but never returned in any response.</p>
    </div>

    <div class="card">
      <h3>MoodLog</h3>
      <table class="schema-table">
        <thead><tr><th>Field</th><th>Type</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td><code>id</code></td><td>ObjectId</td><td></td></tr>
          <tr><td><code>user</code></td><td>ObjectId</td><td><span class="required">required</span> — set from the authenticated request, never from client input</td></tr>
          <tr><td><code>mood</code></td><td>enum</td><td><span class="required">required</span></td></tr>
          <tr><td><code>tags</code></td><td>enum[]</td><td><span class="required">required</span>, 1–3 items</td></tr>
          <tr><td><code>reflection</code></td><td>string</td><td><span class="required">required</span>, max 150 chars</td></tr>
          <tr><td><code>sleepHours</code></td><td>enum</td><td><span class="required">required</span></td></tr>
          <tr><td><code>loggedAt</code></td><td>date</td><td>default now</td></tr>
          <tr><td><code>createdAt</code>, <code>updatedAt</code></td><td>date</td><td></td></tr>
        </tbody>
      </table>
      <p class="desc"><strong>mood:</strong>
        <span class="enum-list"><code>veryHappy</code><code>happy</code><code>neutral</code><code>sad</code><code>verySad</code></span>
      </p>
      <p class="desc"><strong>sleepHours:</strong>
        <span class="enum-list"><code>9+</code><code>7-8</code><code>5-6</code><code>3-4</code><code>0-2</code></span>
      </p>
      <p class="desc"><strong>tags</strong> (choose 1–3):
        <span class="enum-list"><code>Joyful</code><code>Down</code><code>Anxious</code><code>Calm</code><code>Excited</code><code>Frustrated</code><code>Lonely</code><code>Grateful</code><code>Overwhelmed</code><code>Motivated</code><code>Irritable</code><code>Peaceful</code><code>Tired</code><code>Hopeful</code><code>Confident</code><code>Stressed</code><code>Content</code><code>Disappointed</code><code>Optimistic</code><code>Restless</code></span>
      </p>
    </div>
  </section>

  <section>
    <h2>Endpoints</h2>

    <div class="card">
      <div class="endpoint-head"><span class="badge post">POST</span><span class="path">/auth/sign-up</span></div>
      <p class="desc">Creates an account and returns a token immediately &mdash; no separate login step.</p>
      <table class="endpoint-table">
        <tr><th>Body</th><td><code>{ email, password }</code></td></tr>
        <tr><th>201</th><td><code>{ token, user }</code></td></tr>
        <tr><th>400</th><td>Email already registered</td></tr>
      </table>
    </div>

    <div class="card">
      <div class="endpoint-head"><span class="badge post">POST</span><span class="path">/auth/sign-in</span></div>
      <table class="endpoint-table">
        <tr><th>Body</th><td><code>{ email, password }</code></td></tr>
        <tr><th>200</th><td><code>{ token, user }</code></td></tr>
        <tr><th>400</th><td>Incorrect email or password</td></tr>
      </table>
    </div>

    <div class="card">
      <div class="endpoint-head"><span class="badge get">GET</span><span class="path">/auth/current</span><span class="lock">&#128274; auth required</span></div>
      <table class="endpoint-table">
        <tr><th>200</th><td><code>{ user }</code></td></tr>
        <tr><th>401</th><td>Missing/invalid token</td></tr>
      </table>
    </div>

    <div class="card">
      <div class="endpoint-head"><span class="badge patch">PATCH</span><span class="path">/users/me</span><span class="lock">&#128274; auth required</span></div>
      <p class="desc">
        Replaces both &ldquo;complete onboarding&rdquo; and &ldquo;update profile&rdquo; &mdash; the same operation either way.
        Flips <code>hasOnboarded</code> to <code>true</code> on first call. Replacing an avatar deletes the previous Cloudinary asset first.
      </p>
      <table class="endpoint-table">
        <tr><th>Body</th><td><code>multipart/form-data</code>: <code>name</code> (required), <code>avatar</code> (optional file, PNG/JPEG, max 3MB)</td></tr>
        <tr><th>200</th><td><code>{ user }</code></td></tr>
        <tr><th>400</th><td>Invalid name, or unsupported/too-large file</td></tr>
      </table>
    </div>

    <div class="card">
      <div class="endpoint-head"><span class="badge post">POST</span><span class="path">/mood-logs</span><span class="lock">&#128274; auth required</span></div>
      <table class="endpoint-table">
        <tr><th>Body</th><td><code>{ mood, tags, reflection, sleepHours }</code></td></tr>
        <tr><th>201</th><td><code>{ log }</code></td></tr>
        <tr><th>400</th><td>Validation error (see Schemas above)</td></tr>
      </table>
    </div>

    <div class="card">
      <div class="endpoint-head"><span class="badge get">GET</span><span class="path">/mood-logs</span><span class="lock">&#128274; auth required</span></div>
      <p class="desc">All of the current user's logs, oldest first.</p>
      <table class="endpoint-table">
        <tr><th>200</th><td><code>MoodLog[]</code></td></tr>
      </table>
    </div>
  </section>

  <footer>Mood Tracker API &mdash; see <a href="https://github.com/GeorgeShani/GITA-re-educate-Back-End-2026" target="_blank" rel="noopener">source</a></footer>
</div>
</body>
</html>
`;
