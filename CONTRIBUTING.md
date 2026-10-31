# Contributing

Thanks for looking. These are the official client SDKs for the
[Neetix Liveliness API](https://liveliness.neetix.in) — issues and pull
requests are welcome, especially anything that makes a first integration
faster.

## Before you open a PR

```bash
npm install     # once, at the repo root (npm workspaces)
just verify     # contract check + every SDK
```

`just verify` must be green. It runs the same recipes CI runs, so there is
nothing that passes locally and fails there. If a toolchain is missing on your
machine, install it (see [DEVELOPER.md](DEVELOPER.md)) rather than skipping the
recipe — a recipe that silently skips would let an unverified SDK look
verified.

Also:

- Keep all seven packages at the **same version**; see
  [PUBLISHING.md](PUBLISHING.md#version-bumps).
- A new endpoint belongs in **every** SDK that should have it. The contract
  check tells you which ones those are, and refuses to pass until each is
  implemented or explicitly excluded with a reason
  ([DEVELOPER.md](DEVELOPER.md#the-contract-check)).
- Add a test for behaviour, not for coverage: the request shape (path, method,
  fields, whether the API key is attached) and the response parsing are what
  break integrations.

## What to put in the PR description

- what changed, and which packages it touches;
- the `just verify` output;
- for a new endpoint: the credit cost and any non-2xx the caller must handle;
- anything that needs the repo owner (a registry account, a token, a tag).

## Reporting a bug

Open an issue with the SDK + version, the call you made, and the full error —
our errors carry a `status` and a stable `messageCode`, and both help a lot.
Please redact API keys and any real applicant images or identity numbers.

## Security

Do not open a public issue for a security problem. Mail **tech@neetix.in**
with the details and we will come back to you. Likewise, never attach a real
selfie, ID image, Aadhaar/PAN number or API key to an issue or PR.

## Code of conduct

Be straightforward and civil. Review comments address the code, not the
person. Behaviour that makes the project unpleasant to work on is grounds for
removal from the discussion.
