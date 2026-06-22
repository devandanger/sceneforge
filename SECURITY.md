# Security Policy

## Supported versions

SceneForge is pre-1.0; only the latest published version on npm receives security
fixes.

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue.

Use GitHub's private vulnerability reporting: go to the repository's
**[Security tab](https://github.com/devandanger/sceneforge/security/advisories/new)**
and click **Report a vulnerability**. Reports land directly with the maintainer
and stay private until a fix is released.

We aim to acknowledge reports within a few days. Once a fix is published, we'll
credit the reporter (unless you prefer to remain anonymous).

## Scope

SceneForge is a CLI that processes local `video.json` files and shells out to
Remotion for rendering. Most relevant to security:

- Untrusted `video.json` / asset paths fed to the CLI.
- The npm release pipeline (token handling, provenance, workflow integrity).

Vulnerabilities in dependencies (e.g. Remotion, ElevenLabs SDK usage) should be
reported to those projects, though we're happy to help coordinate.
