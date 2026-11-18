# 02: Catalog ↔ openapi.yaml drift test

**What to build:** A vitest test (node environment) that extracts the `#apiDocCatalog` JSON from the HTML and parses `docs/api/openapi.yaml` with the existing `yaml` package. It asserts the drift rules in `../spec.md` → Testing Decisions → Seam 2.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Every non-`missing` catalog operation exists in OAS with the same method and path
- [ ] Every OAS operation is either referenced by an action or listed in `gaps.apiWithoutUi`
- [ ] The catalog's error status codes are a subset of the OAS responses
- [ ] Fails with a readable message naming the drifting operationId
