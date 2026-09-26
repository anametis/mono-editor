# Kara engineering handbook

This handbook describes the implementation in this repository. It separates existing behavior from release work still required. Kara currently delivers a publishing workflow with staff review, scheduled publication, reader accounts, and private bookmarks. It is not a certification of production capacity, availability, or regulatory compliance.

## Start here

| Your task                                                                | Guide                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------- |
| Install dependencies, run one app, build or test selected projects       | [Development](development.md)                            |
| Understand processes, request paths, and memory/state ownership          | [Architecture](architecture/overview.md)                 |
| Find an application, library, UI component, or supporting tool           | [Component catalog](architecture/components.md)          |
| Understand revisions, transactions, scheduling, and database constraints | [Data and publishing](architecture/data.md)              |
| Call the API or update its generated client                              | [API guide](architecture/api.md)                         |
| Understand sessions, permissions, MFA, and trust boundaries              | [Security](architecture/security.md)                     |
| Change dependencies without crossing domain boundaries                   | [Ownership and dependencies](architecture/boundaries.md) |
| Run component, integration, and browser checks                           | [Testing](architecture/testing.md)                       |
| Deploy, diagnose incidents, recover data, or assess release readiness    | [Operations](architecture/operations.md)                 |
| See previously recorded verification results                             | [Verification evidence](architecture/verification.md)    |

## Documentation maintenance

Update the relevant guide in the same change that alters behavior. Application maintainers own their component entries; domain maintainers own business rules; release operators own environment specific procedures and contacts. These are responsibilities, not claims that named teams or on-call rotations are configured.

Use relative links and keep Mermaid diagrams beside the explanations they support. GitHub and Mermaid capable Markdown viewers render the diagrams; other viewers show their readable source. The diagrams describe logical relationships, not measured heap sizes.

Treat source and resolved Nx targets as authoritative. Query `pnpm nx show project <name> --json` when commands change. Generate API artifacts from controllers and DTOs rather than editing generated files. Historical verification notes show what passed at that time, not a current release sign-off.

Record significant future architecture decisions with their context, alternatives, consequences, and date. Keep proposed behavior distinct from implemented behavior; no additional service or infrastructure is implied by this handbook.
