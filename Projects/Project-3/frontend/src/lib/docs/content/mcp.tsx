import { Code } from "@/components/docs/prose";

/** The guide for the MCP endpoint (`POST /mcp`). Everything stated here is what the API does; see backend AGENTS.md. */
export function McpGuide() {
  return (
    <>
      <p>
        Gridline speaks the Model Context Protocol, so an AI agent such as
        Claude Code, Claude Desktop or Cursor can work with your company&apos;s
        data: list files, read quality reports, compare versions and upload new
        data. It uses the same services as the web app and the REST API, so
        access, quotas and the audit log work exactly as they do there.
      </p>

      <h2 id="connect">Connect an agent</h2>
      <ol>
        <li>
          Create an API key (<strong>Developers → API keys</strong>) with the{" "}
          <code>mcp</code> scope, plus the scopes for what the agent may do.
        </li>
        <li>Give the key to your agent&apos;s MCP client.</li>
      </ol>
      <p>With Claude Code:</p>
      <Code>{`claude mcp add --transport http gridline https://YOUR-HOST/api/mcp \\
  --header "Authorization: Bearer gl_live_…"`}</Code>
      <p>
        Any client that supports Streamable HTTP and a bearer header works the
        same way. Behind the proxy the address is <code>/api/mcp</code>; reached
        directly it is <code>/mcp</code>.
      </p>

      <h2 id="access">What the agent can see</h2>
      <p>
        The agent is offered only the tools its key may use. A key acts as the
        person who created it, as they are right now: demote or disable them and
        the agent changes with them on its next call. A key is never more
        powerful than its owner or its scopes.
      </p>
      <h3 id="scopes">Scopes</h3>
      <ul>
        <li>
          <code>mcp</code>: may use the endpoint at all.
        </li>
        <li>
          <code>files:read</code>: files, versions, reports, previews,
          comparisons, comments, the plan and its quota, and the quality rules.
        </li>
        <li>
          <code>files:write</code>: upload a file or a new version, and rebuild
          a report.
        </li>
        <li>
          <code>rules:write</code> (admins): create, edit and delete quality
          rules.
        </li>
        <li>
          <code>billing:read</code> (admins): the running bill and invoices.
        </li>
        <li>
          <code>audit:read</code> (admins): the audit log.
        </li>
        <li>
          <code>notifications:read</code>: read your own notifications and mark
          them read.
        </li>
      </ul>

      <h2 id="uploads">Uploading through an agent</h2>
      <p>
        An agent sends a file as plain <code>text</code> (for a CSV) or as{" "}
        <code>base64</code> (for any spreadsheet), up to 8 MB. Larger files go
        through <code>POST /files</code>. What the file is decided from its
        content, never its name, exactly as for any upload. It counts against
        the plan&apos;s file quota, and a refusal says why.
      </p>
      <p>
        If a call times out, repeat it with the same <code>idempotencyKey</code>{" "}
        (any UUID): it cannot upload twice.
      </p>

      <h2 id="record">The record</h2>
      <p>
        Everything an agent changes is written to the audit log with{" "}
        <code>via: &quot;mcp&quot;</code> and the key that acted, so you can see
        what an agent did and when. The read-only demo company offers agents no
        write tools at all.
      </p>

      <h2 id="not-exposed">What an agent cannot do</h2>
      <p>
        Comments, people, plans and payment, API keys, webhooks, deleting files
        and changing who can see one stay with a signed-in person. Revoke the
        key and the agent is cut off immediately.
      </p>
    </>
  );
}
