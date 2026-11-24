# Motion Drive API Contract

This document describes the HTTP API routes currently implemented in `src/app/api`.
Unless otherwise stated, request and response bodies use JSON and responses are not
cached. The application currently has no API authentication or authorization layer;
keep these endpoints on a trusted network because backups include driver information
and document contents.

## Route inventory

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check database and local upload-storage readiness. |
| `GET` | `/api/backup/export` | Download a JSON backup of database records and stored files. |

`POST /api/backup/import` is planned in the production blueprint but is not implemented
yet. The only current page route is `GET /` (the application home page); it is not an
API endpoint.

## `GET /api/health`

Checks the database with a lightweight query and verifies that `storage/uploads` is
readable and writable. The storage check creates and removes a temporary probe file.

### Request

- No request body or query parameters.

### Responses

`200 OK` when both checks pass:

```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "storage": "ok"
  }
}
```

`503 Service Unavailable` when either check fails. The response has the same shape,
with `"status": "error"` and `"error"` for each failed check:

```json
{
  "status": "error",
  "checks": {
    "database": "ok",
    "storage": "error"
  }
}
```

The endpoint does not expose underlying error details.

### Headers

- `Content-Type: application/json`
- `Cache-Control: no-store`

## `GET /api/backup/export`

Downloads a complete backup as a JSON attachment. Database records are read for all
vehicles, drivers, contracts, vehicle swaps, and documents. Stored files in
`storage/uploads` that match the storage helper's generated-file naming rules are
embedded in the response as Base64.

### Request

- No request body or query parameters.

### Success response

`200 OK`

Headers:

- `Content-Type: application/json; charset=utf-8`
- `Content-Disposition: attachment; filename="MotionDrive_Backup_YYYY-MM-DD.json"`
- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`

The filename date uses the `Australia/Melbourne` timezone.

Response body:

```json
{
  "format": "MotionDrive_Backup",
  "version": 1,
  "exportedAt": "2026-11-24T10:00:00.000Z",
  "records": {
    "vehicles": [],
    "drivers": [],
    "contracts": [],
    "vehicleSwaps": [],
    "documents": []
  },
  "files": [
    {
      "storedName": "54735693-3616-428e-81c2-9cf348a96724.pdf",
      "originalName": "rental-agreement.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 12345,
      "modifiedAt": "2026-11-24T09:30:00.000Z",
      "dataBase64": "JVBERi0x..."
    }
  ]
}
```

Contract details:

- `records` contains arrays of complete database rows for the corresponding Prisma
  models. See `prisma/schema.prisma` for their fields.
- Dates are serialized as ISO 8601 strings; nullable dates remain `null`.
- Prisma decimal values are serialized as decimal strings. Document `sizeBytes` is
  serialized as a base-10 string because the database field is a `BigInt`.
- `files` contains each stored file once, even when multiple document records link to
  that file. `sizeBytes` is an integer byte count and `dataBase64` contains the exact
  file bytes encoded as Base64.
- For files without a linked document row, `originalName` falls back to `storedName`
  and `mimeType` is inferred from its allowed file extension.
- Empty record arrays or an empty `files` array are valid.

### Failure response

`500 Internal Server Error` if database access, storage listing, or reading any listed
file fails. The endpoint does not return a partial backup.

```json
{
  "error": "Backup export failed. Check the server logs for details."
}
```

Headers include `Content-Type: application/json` and `Cache-Control: no-store`.

## Not yet implemented

The production blueprint calls for `POST /api/backup/import`, including strict backup
validation and restore behavior. Until that route is implemented, clients must not
assume that exported backups can be uploaded through the API.
