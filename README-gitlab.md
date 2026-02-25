# RudderStack Transformation Action - GitLab CI

This project provides a GitLab CI template that allows developers to test and publish user transformations and custom libraries directly from their GitLab repository. It uses the same core logic as the [GitHub Action](./README.md). To learn more about user transformations, see the [RudderStack documentation](https://rudderstack.com/docs/transformations).

## Prerequisites

- The email address associated with your RudderStack workspace.
- A [Service Access Token](https://www.rudderstack.com/docs/dashboard-guides/service-access-tokens/) with [Admin](http://www.rudderstack.com/docs/dashboard-guides/user-management/#organization-roles) permissions.

For production use cases, RudderStack recommends using a Service Access Token instead of a [Personal Access Token](https://www.rudderstack.com/docs/dashboard-guides/personal-access-token).

## Setup

### 1. Configure CI/CD Variables

In your GitLab project, go to **Settings > CI/CD > Variables** and add:

| Variable                   | Required | Masked | Description            |
| -------------------------- | -------- | ------ | ---------------------- |
| `RUDDERSTACK_EMAIL`        | Yes      | No     | Workspace owner email  |
| `RUDDERSTACK_ACCESS_TOKEN` | Yes      | Yes    | Workspace access token |

> For security, always mark `RUDDERSTACK_ACCESS_TOKEN` as **masked** and **protected** in your CI/CD variable settings.

### 2. Include the Template

Add the following to your project's `.gitlab-ci.yml`:

```yaml
include:
  - remote: "https://raw.githubusercontent.com/rudderlabs/rudder-transformation-action/main/gitlab-ci-template.yml"
```

If you have mirrored or forked this repository to your own GitLab instance, use a project-level include instead:

```yaml
include:
  - project: "your-group/rudder-transformation-action"
    ref: main
    file: "/gitlab-ci-template.yml"
```

### 3. Define Jobs

Extend the `.rudderstack-transformation` hidden job in your `.gitlab-ci.yml`:

**Test only (default):**

```yaml
rudderstack-test:
  extends: .rudderstack-transformation
  variables:
    META_PATH: "./code/meta.json"
```

**Test and publish on the default branch:**

```yaml
rudderstack-test:
  extends: .rudderstack-transformation
  variables:
    META_PATH: "./code/meta.json"

rudderstack-publish:
  extends: .rudderstack-transformation
  variables:
    META_PATH: "./code/meta.json"
    TEST_ONLY: "false"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

## Complete Example

```yaml
include:
  - remote: "https://raw.githubusercontent.com/rudderlabs/rudder-transformation-action/main/gitlab-ci-template.yml"

stages:
  - test
  - publish

rudderstack-test:
  extends: .rudderstack-transformation
  stage: test
  variables:
    META_PATH: "./code/meta.json"
    UPLOAD_TEST_ARTIFACT: "true"

rudderstack-publish:
  extends: .rudderstack-transformation
  stage: publish
  variables:
    META_PATH: "./code/meta.json"
    TEST_ONLY: "false"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

## Variables Reference

### Job Variables

These can be set per-job under `variables:`:

| Variable                      | Default                                                          | Description                                                    |
| ----------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `META_PATH`                   | `meta.json`                                                      | Path to the meta file describing transformations and libraries |
| `RUDDERSTACK_SERVER_ENDPOINT` | `https://api.rudderstack.com`                                    | RudderStack API URL                                            |
| `UPLOAD_TEST_ARTIFACT`        | `false`                                                          | Enable the artifact upload flag                                |
| `TEST_ONLY`                   | `true`                                                           | Set to `false` to publish after testing                        |

### CI/CD Variables (Project-Level)

These should be configured in **Settings > CI/CD > Variables**:

| Variable                   | Description                             |
| -------------------------- | --------------------------------------- |
| `RUDDERSTACK_EMAIL`        | Workspace owner email                   |
| `RUDDERSTACK_ACCESS_TOKEN` | Workspace access token (mark as masked) |

## Meta File

The meta file tells the pipeline which transformations and libraries to test and publish. See the [main README](./README.md#inputs) for the full schema.

**Example `meta.json`:**

```json
{
  "transformations": [
    {
      "file": "./code/code.js",
      "name": "my-transformation",
      "description": "javascript transformation",
      "language": "javascript",
      "test-input-file": "./code/events.json",
      "expected-output": "./code/expected.json"
    }
  ],
  "libraries": [
    {
      "file": "./code/lib.js",
      "name": "my-library",
      "description": "javascript library",
      "language": "javascript"
    }
  ]
}
```

**Notes:**

- Allowed values for `language` are `javascript` and `pythonfaas`.
- All file paths should be relative to the repository root.

## Artifacts

Test output artifacts are automatically collected from the `test-outputs/` directory, regardless of whether the job passes or fails. They are retained for 1 week by default.

When `UPLOAD_TEST_ARTIFACT` is set to `true` and test inputs are provided:

- Actual outputs are written to `test-outputs/<camelCaseName>_output.json`.
- If `expected-output` is provided and the output differs, a diff is written to `test-outputs/<camelCaseName>_diff.json`.

You can download these from the job's **Artifacts** section in the GitLab UI.

## Pinning a Version

The template clones the action repo at a hardcoded major version tag (`v1`), which tracks the latest stable release. To pin to a specific release, include the template from that tag instead of `main`:

```yaml
include:
  - remote: "https://raw.githubusercontent.com/rudderlabs/rudder-transformation-action/v1.1.4/gitlab-ci-template.yml"
```
