# Night Factory: frontend Linux build proof

Source baseline57ec0c2d631f7e41f2a2d08499febbf1dc330047. Committed tracked
frontend archive used as isolated Docker context; only candidate Dockerfile and
package engines were overlaid. No .env, host node_modules or runtime config entered
the context. Candidate hashes and artifact identity: docs/evidence/night-20261002/runtime.json.

Before: node20.20.2 + pinned pnpm11.23.0 failed install with node:sqlite unavailable,
minimumNode22.13 warning. Official pnpm compatibility and Node LTS schedule checked.
After: official Node22.23.3-alpine digest0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402,
all three existing Docker stages, same pnpm/lock. `docker build` exit0 with frozen
install447 packages, Next15.5.26 compile/typecheck/static11 pages/standalone copy.
Runner image02d9133200546259f741811ecb500e97c16fd7ff6d0e15fddf78cbc06e8970d3
started only on127.0.0.1 dynamic port, configured nextjs, actualUID1001,
Nodev22.23.3, HTTP200 valid HTML. Exact owned disposable container stopped and
removed by --rm; existing images/containers/data preserved.

Builder `pnpm exec vitest run --maxWorkers=1` in network-disabled disposable
container:23 files/91 PASS,23.02s; `pnpm lint`:PASS. No accepted tests rewritten,
dependency lock unchanged. Docker Desktop was started hidden as local service;
Windows developer mode/symlink privileges and global host settings unchanged.

MC-HOST-SYMLINK-01 is closed through equivalent actual Linux build proof; this
does not prove a Windows standalone build or live client→API/MT5 scenario.
D1–D4 and TD-BT-001 remain open; no data migration/Stage7/deployment happened.
README/selected STAGES/system SPEC/architecture/decision updated. ROADMAP and
market-data SPEC checked unchanged because product scope did not change.
