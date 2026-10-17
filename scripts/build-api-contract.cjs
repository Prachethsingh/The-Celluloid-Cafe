const fs = require('node:fs/promises');
const path = require('node:path');
const output = path.resolve(__dirname, '../docs/api/openapi.json');
const response = description => ({ description });
const object = properties => ({ type: 'object', properties });
const text = { type: 'string' };
const credentials = object({ email: { type: 'string', format: 'email', maxLength: 254 }, password: { type: 'string', minLength: 12, maxLength: 128 }, display_name: { type: 'string', minLength: 1, maxLength: 80 } });
credentials.required = ['email', 'password']; credentials.additionalProperties = false;
const body = schema => ({ required: true, content: { 'application/json': { schema } } });
const account = [{ sessionCookie: [] }];
const mutation = [{ sessionCookie: [], csrfToken: [] }];
const id = name => ({ name, in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 150 } });
const operation = (summary, success = '200', security, extra = {}) => ({ summary, ...(security ? { security } : {}), responses: { [success]: response('Success'), '400': response('Invalid request'), ...(security ? { '401': response('Sign in required'), '403': response('Invalid request token or insufficient permission') } : {}), '429': response('Request limit reached'), '500': response('Unexpected server error; correlate X-Request-ID') }, ...extra });
const paths = {
  '/health': { get: operation('Public API liveness') },
  '/auth/session': { get: operation('Current account and CSRF token, or null when anonymous') },
  '/auth/register': { post: operation('Register an ordinary account and issue a cookie session', '201', undefined, { requestBody: body(credentials) }) },
  '/auth/login': { post: operation('Verify credentials and issue a cookie session', '200', undefined, { requestBody: body(credentials) }) },
  '/auth/logout': { post: operation('Revoke the current session', '200', mutation) },
  '/auth/password': { post: operation('Change password, revoke all previous sessions, issue a new session', '200', mutation, { requestBody: body({ ...object({ current_password: { ...text, minLength: 1, maxLength: 128 }, new_password: { ...text, minLength: 12, maxLength: 128 } }), required: ['current_password', 'new_password'], additionalProperties: false }) }) },
  '/auth/sessions': { get: operation('List owned active sessions without raw session tokens', '200', account) },
  '/auth/sessions/{id}': { parameters: [id('id')], delete: operation('Revoke an owned session', '200', mutation) },
  '/auth/export': { get: operation('Export account and owned library, omitting credential secrets', '200', account) },
  '/auth/account': { delete: operation('Delete account and owned library/sessions after password confirmation', '200', mutation, { requestBody: body({ ...object({ password: text }), required: ['password'] }) }) },
  '/library': { get: operation('Read the signed-in account watchlist and progress', '200', account) },
  '/library/{kind}/{id}': {
    parameters: [id('id'), { name: 'kind', in: 'path', required: true, schema: { type: 'string', enum: ['watchlist', 'progress'] } }],
    put: operation('Upsert an owned item; body id must match path id; maximum 16 KiB JSON', '200', mutation, { requestBody: body({ ...object({ id: text, title: text, type: { type: 'string', enum: ['movie', 'series'] }, progress_seconds: { type: 'number', minimum: 0, maximum: 1000000 }, duration_seconds: { type: 'number', minimum: 0, maximum: 1000000 } }), required: ['id', 'title', 'type'], additionalProperties: true }) }),
    delete: operation('Remove an owned library item', '200', mutation),
  },
  '/playback/sources/{type}/{id}': { parameters: [id('type'), id('id')], get: operation('Configured sources bound to exact title/episode, or an unavailable response', '200', undefined, { parameters: [{ name: 'episode_id', in: 'query', schema: { ...text, maxLength: 150 } }] }) },
  '/playback/session': { post: operation('Issue a resource-bound playback token only when a source exists', '201', undefined, { requestBody: body({ ...object({ content_type: { type: 'string', enum: ['movie', 'series'] }, content_id: { ...text, minLength: 1, maxLength: 150 }, episode_id: { ...text, nullable: true }, country_code: { ...text, pattern: '^[A-Z]{2}$' } }), required: ['content_type', 'content_id'], additionalProperties: false }), responses: { '201': response('Configured source URLs and signed resource-bound token; no DRM or quality entitlement claim'), '400': response('Invalid request'), '409': response('SOURCE_UNAVAILABLE') } }) },
  '/playback/{type}/{id}/session': { parameters: [id('type'), id('id')], get: operation('Validate playback token expiry and exact route resource', '200', undefined, { parameters: [{ name: 'token', in: 'query', required: true, schema: text }], responses: { '200': response('Current source inventory'), '403': response('Invalid, expired, or mismatched token') } }) },
  '/admin/system/status': { get: operation('Administrator-only real catalog counts, dependency state, and jobs', '200', account) },
  '/admin/sync': { post: operation('Administrator-only transactional upstream catalog sync; records job/audit state', '200', mutation, { responses: { '200': response('Completed synchronization'), '401': response('Sign in required'), '403': response('Admin/CSRF required'), '409': response('Synchronization already running'), '502': response('Upstream unavailable; catalog unchanged') } }) },
  '/admin/sources': { get: operation('Administrator-only configured source inventory', '200', account), post: operation('Administrator-only public title media source configuration', '201', mutation, { requestBody: body({ ...object({ content_id: text, type: { type: 'string', enum: ['movie', 'series'] }, episode_id: text, url: { ...text, maxLength: 2048, description: 'HTTPS without embedded credentials/private address, or a safe /media/ filename' }, name: { ...text, minLength: 1, maxLength: 120 }, format: { type: 'string', enum: ['mp4', 'webm', 'm3u8'] }, provenance: { ...text, minLength: 1, maxLength: 500 } }), required: ['content_id', 'type', 'url', 'name', 'format', 'provenance'], additionalProperties: false }) }) },
  '/admin/sources/{id}': { parameters: [id('id')], delete: operation('Administrator-only source removal with audit event', '200', mutation) },
  '/admin/audit': { get: operation('Administrator-only recent audit events', '200', account) },
  '/vega/identity/{id}': { parameters: [id('id')], get: operation('Confirmed content identity or null; no placeholder IMDb fallback') },
  '/vega/build': { get: operation('Provider and sandbox build provenance') },
  '/vega/runtime': { get: operation('Compiled original browser sandbox document; 503 when unbuilt') },
  '/vega/providers/{provider}/modules/{module}': { parameters: [id('provider'), id('module')], get: operation('Compiled allowlisted original provider module; 404 when missing') },
};
const parameters = {
  q: { ...text, maxLength: 200 }, type: { type: 'string', enum: ['all', 'movie', 'series'] }, genre: text, language: text,
  country: { ...text, pattern: '^[A-Z]{2}$' }, platform: text, min_rating: { type: 'number', minimum: 0, maximum: 10 },
  min_year: { type: 'integer', minimum: 1800, maximum: 2200 }, max_year: { type: 'integer', minimum: 1800, maximum: 2200 },
  sort: { type: 'string', enum: ['popularity', 'rating', 'year', 'title'] }, page: { type: 'integer', minimum: 1, maximum: 100000 }, limit: { type: 'integer', minimum: 1, maximum: 100 },
};
paths['/catalog'] = { get: operation('Persistent catalog search/filter/sort with bounded pagination; demo seed metadata explicitly labeled', '200', undefined, { parameters: Object.entries(parameters).map(([name, schema]) => ({ name, in: 'query', schema })), responses: { '200': { description: 'Paged catalog', content: { 'application/json': { schema: { ...object({ items: { type: 'array', items: { type: 'object', additionalProperties: true } }, total: { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' }, has_more: { type: 'boolean' } }), required: ['items', 'total', 'page', 'limit', 'has_more'] } } } }, '400': response('Invalid filters or min_year greater than max_year') } }) };
const spec = { openapi: '3.0.3', info: { title: 'CinePulse MVP API', version: '1.0.0', description: 'Active MVP contracts. Administrator permissions are enforced server-side. Maximum JSON request body: 64 KiB. Generated demo HLS/DASH manifests are retired.' }, servers: [{ url: '/api/v1' }], components: { securitySchemes: { sessionCookie: { type: 'apiKey', in: 'cookie', name: 'cp_session' }, csrfToken: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' } } }, paths };
fs.writeFile(output, JSON.stringify(spec, null, 2) + '\n').then(() => console.log('Generated MVP OpenAPI contract.')).catch(error => { console.error(error.message); process.exitCode = 1; });
