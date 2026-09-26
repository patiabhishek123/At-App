# Kubernetes manifests

Kustomize-based: `base/` holds the shared Deployment/Service/ConfigMap/Secret/HPA,
and `overlays/{dev,staging,prod}/` patch per-environment values (namespace,
replica count, resource limits, `APP_ENV`, `ALLOWED_ORIGINS`, image tag).

## Deploying

```sh
kubectl apply -k k8s/overlays/dev       # or staging / prod
```

Each overlay targets its own namespace (`atapp-dev`, `atapp-staging`,
`atapp-prod`) — create it first if it doesn't exist, or add
`--dry-run=client -o yaml | kubectl apply -f -` for a namespace manifest of
your own.

## Image tag

`overlays/<env>/kustomization.yaml` pins an image tag (`dev`, `staging`,
`latest`). CI/CD should override this at deploy time rather than editing the
file by hand, e.g.:

```sh
cd k8s/overlays/prod
kustomize edit set image atapp-server=<registry>/atapp-server:<git-sha>
```

## Secrets

`base/secret.yaml` is a **template** — every value is a `CHANGEME`
placeholder. Do not apply it as-is. In a real cluster, populate
`atapp-server-secrets` via one of:

- Kubernetes Secrets created out-of-band (`kubectl create secret` / your CI
  pipeline), never committed to git
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets), committed
  in their encrypted form
- [External Secrets Operator](https://external-secrets.io/), syncing from AWS
  Secrets Manager / GCP Secret Manager / Vault

## What's verified vs. what's still a decision

Verified locally (see the PR/commit history for how): all three overlays
build and pass `kubectl apply --dry-run=server` against a real API server,
and a container built from `server/Dockerfile` runs correctly under the
Deployment's `securityContext` (non-root, read-only root filesystem).

Not decided here, because they depend on your infrastructure choices:
target cloud/registry, ingress/TLS termination, and which secrets backend to
wire up from the list above.
