import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

let mongod: ChildProcess | undefined;
let dbPath: string | undefined;

function waitForPort(port: number, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const attempt = (): void => {
      const socket = net.connect({ port, host: '127.0.0.1' });
      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`mongod did not start within ${timeoutMs}ms`));
        } else {
          setTimeout(attempt, 300);
        }
      });
    };
    attempt();
  });
}

/**
 * Boots a disposable standalone mongod for the whole test run and points
 * MONGODB_URI at it. Tests are isolated from any real database.
 */
export async function setup(): Promise<void> {
  dbPath = await mkdtemp(path.join(tmpdir(), 'clinic-test-db-'));
  const port = await findFreePort();
  mongod = spawn('mongod', [
    '--dbpath', dbPath,
    '--port', String(port),
    '--bind_ip', '127.0.0.1',
  ], { stdio: 'ignore' });

  mongod.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      // eslint-disable-next-line no-console
      console.error(`mongod exited early with code ${code}`);
    }
  });

  await waitForPort(port);
  process.env.MONGODB_URI = `mongodb://127.0.0.1:${port}/clinic-test?directConnection=true`;
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('failed to allocate a port'));
        return;
      }
      const { port } = address;
      // Hold the socket open until mongod binds; free it immediately after.
      server.once('close', () => resolve(port));
      server.close();
    });
    server.on('error', reject);
  });
}

export async function teardown(): Promise<void> {
  if (mongod) {
    mongod.kill();
    await new Promise((r) => setTimeout(r, 500));
  }
  if (dbPath) {
    await rm(dbPath, { recursive: true, force: true });
  }
}
