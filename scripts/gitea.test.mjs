import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveApp } from './apps.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPOSE = readFileSync(join(ROOT, 'deploy', 'docker-compose.yml'), 'utf8');
const TEMPLATE = readFileSync(join(ROOT, 'deploy', 'nginx', 'default.conf.template'), 'utf8');
const ENV_EXAMPLE = readFileSync(join(ROOT, 'deploy', '.env.example'), 'utf8');

void describe('gitea app registration', () => {
    void it('resolves gitea and git alias to the gitea service', () => {
        assert.equal(resolveApp('gitea')?.service, 'gitea');
        assert.equal(resolveApp('git')?.service, 'gitea');
    });
});

void describe('gitea compose service', () => {
    void it('uses a pinned upstream image on the shared postgres database', () => {
        assert.match(COMPOSE, /gitea\/gitea:\d+\.\d+\.\d+/);
        assert.match(COMPOSE, /GITEA__database__HOST: postgres:5432/);
        assert.match(COMPOSE, /GITEA__database__NAME: gitea/);
    });

    void it('keeps SSH on host 2222 by default and persists data in gitea-data', () => {
        assert.ok(COMPOSE.includes('${GITEA_SSH_PORT:-2222}:22'));
        assert.ok(COMPOSE.includes('${GITEA_SSH_BIND:-127.0.0.1}'));
        assert.ok(COMPOSE.includes('gitea-data:/data'));
        assert.match(COMPOSE, /\n  gitea-data:/);
    });

    void it('defaults ROOT_URL to the /git/ subpath', () => {
        assert.ok(COMPOSE.includes('GITEA__server__ROOT_URL: ${GITEA_ROOT_URL:-http://localhost/git/}'));
    });

    void it('skips the web installer so the subpath serves immediately', () => {
        assert.ok(COMPOSE.includes("GITEA__security__INSTALL_LOCK: 'true'"));
    });

    void it('joins the gateway network behind postgres health', () => {
        const gitea = COMPOSE.slice(COMPOSE.indexOf('\n  gitea:'));
        assert.ok(gitea.includes('condition: service_healthy'));
        assert.ok(gitea.includes('- baseball'));
    });

    void it('seeds fresh postgres volumes with the gitea database', () => {
        assert.ok(COMPOSE.includes('dockerfile: postgres/Dockerfile'));
        assert.ok(
            readFileSync(join(ROOT, 'deploy', 'postgres', 'Dockerfile'), 'utf8').includes(
                'postgres/initdb/',
            ),
        );
        assert.ok(readFileSync(join(ROOT, 'deploy', 'postgres', 'initdb', '10-gitea.sql'), 'utf8').includes('CREATE DATABASE gitea'));
    });
});

void describe('gitea gateway route', () => {
    void it('redirects bare /git to /git/ and strips the prefix upstream', () => {
        assert.ok(TEMPLATE.includes('location = /git'));
        assert.ok(TEMPLATE.includes('location /git/'));
        const block = TEMPLATE.slice(TEMPLATE.indexOf('location /git/'));
        assert.ok(block.slice(0, 800).includes('rewrite ^/git/(.*)$ /$1 break;'));
        assert.ok(block.includes('proxy_pass $upstream_gitea;'));
    });
});

void describe('gitea env docs', () => {
    void it('documents ROOT_URL with /git/ and one-time database creation', () => {
        assert.ok(ENV_EXAMPLE.includes('GITEA_ROOT_URL='));
        assert.ok(ENV_EXAMPLE.includes('/git/'));
        assert.ok(ENV_EXAMPLE.includes('GITEA_SSH_BIND='));
        assert.ok(ENV_EXAMPLE.includes('CREATE DATABASE gitea'));
    });
});
