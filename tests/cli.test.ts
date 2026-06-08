import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('CodeGen CLI', () => {
  const cliPath = join(process.cwd(), 'scripts', 'codegen-cli.ts');
  const tsxCliPath = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const runCli = (args: string[]) => {
    return execFileSync(process.execPath, [tsxCliPath, cliPath, ...args], { encoding: 'utf8', stdio: 'pipe' });
  };

  it('generates python code from isx and prints to stdout', () => {
    const tmpFile = join(tmpdir(), `test-cli-${Date.now()}.isx`);
    writeFileSync(
      tmpFile,
      `diagram Test : class {
        class User {
          +name: String
        }
      }`,
      'utf8'
    );

    try {
      const output = runCli([tmpFile, '--lang', 'python']);
      expect(output).toContain('class User:');
      expect(output).toContain('name: str');
    } finally {
      rmSync(tmpFile, { force: true });
    }
  });

  it('generates java code and writes to directory', () => {
    const tmpFile = join(tmpdir(), `test-cli-${Date.now()}.isx`);
    const tmpOut = mkdtempSync(join(tmpdir(), 'isx-out-'));
    writeFileSync(
      tmpFile,
      `diagram Test : class {
        package app {
          class User {
            +name: String
          }
        }
      }`,
      'utf8'
    );

    try {
      runCli([tmpFile, '--lang', 'java', '--out', tmpOut]);
      const userJava = join(tmpOut, 'app', 'User.java');
      expect(existsSync(userJava)).toBe(true);
      const content = readFileSync(userJava, 'utf8');
      expect(content).toContain('package app;');
      expect(content).toContain('public class User');
    } finally {
      rmSync(tmpFile, { force: true });
      rmSync(tmpOut, { recursive: true, force: true });
    }
  });

  it('supports --diagram selection for multi-diagram source files', () => {
    const tmpFile = join(tmpdir(), `test-cli-${Date.now()}.isx`);
    writeFileSync(
      tmpFile,
      `diagram One : class {
        class UserOne {}
      }
      diagram Two : class {
        class UserTwo {}
      }`,
      'utf8'
    );

    try {
      // Test without --diagram flag prints warning and falls back to first diagram
      const result = spawnSync(process.execPath, [tsxCliPath, cliPath, tmpFile, '--lang', 'python'], { encoding: 'utf8' });
      expect(result.status).toBe(0);
      expect(result.stderr).toContain('Warning: Multiple diagrams found in file. Using the first one: "One".');
      expect(result.stdout).toContain('class UserOne:');
      expect(result.stdout).not.toContain('class UserTwo:');

      // Test with --diagram flag
      const outputSecond = runCli([tmpFile, '--lang', 'python', '--diagram', 'Two']);
      expect(outputSecond).toContain('class UserTwo:');
      expect(outputSecond).not.toContain('class UserOne:');
    } finally {
      rmSync(tmpFile, { force: true });
    }
  });
});
