# On-premises 7pace

The server runs entirely in Node.js on Linux, macOS and Windows.
On-premises authentication uses NTLMv2 with explicit credentials, rather than
Cloud tokens. It does not invoke curl or reuse the operating system login.

## Configuration

Set these environment variables, or put them in an untracked .env file:

    SEVENPACE_ORGANIZATION=example-collection
    SEVENPACE_BASE_URL=https://timetracker.example.com
    SEVENPACE_API_PATH=/api/example-collection/rest
    SEVENPACE_AUTH_METHOD=ntlm
    SEVENPACE_USERNAME=example-user
    SEVENPACE_PASSWORD=your-password
    SEVENPACE_DOMAIN=EXAMPLE
    MCP_TRANSPORT=stdio

The domain may also be supplied as part of DOMAIN\\username.
SEVENPACE_WORKSTATION is optional. A Cloud token and an Azure DevOps PAT are
not required for NTLM. Use HTTPS for real deployments. Certificate validation
remains enabled. Redirects are disabled for authenticated requests.

An NTLM-enabled endpoint with NTLMv2 target information is required. A server
that requires Kerberos exclusively is not supported by this authentication
mode. It does not fall back to NTLMv1.

## MCP clients

Build with npm ci and npm run build. Configure the client for stdio with
node as the command and the absolute path to dist/index.js as the argument.
Supply connection settings through the client's environment configuration.
The working directory must contain .env if that is how credentials are loaded.

MCP_TRANSPORT=stdio prevents a client's inherited PORT from enabling HTTP.
No personal launcher script is included in the repository.

## Validation

    npm run build
    npm run test:onprem

Tests use a local NTLM challenge server with synthetic credentials and verify
the handshake, connection reuse, HTTP errors, redirects, missing credentials,
REST envelopes, filters, pagination and write payloads. No production writes
are performed.

For an optional live read probe, configure the environment above, plus:

    SEVENPACE_TEST_DATE=YYYY-MM-DD
    npm run test:live-read

The probe starts the built server directly, verifies MCP discovery and reads
activity types, worklogs and a report. It does not create, update or delete
worklogs. Date and work item filters are verified when entries exist for the
selected date. Reports cover the authenticated user's worklogs.

On-premises API authentication:
https://github.com/7pace/timetracker-rest-api-samplecode
