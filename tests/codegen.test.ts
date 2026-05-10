import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '../src/parser/index.js';
import { analyze } from '../src/semantics/analyzer.js';
import { generateCode, generateCodeBundle } from '../src/codegen/index.js';

function classDiagram(source: string) {
  const parsed = parse(source);
  expect(parsed.errors, JSON.stringify(parsed.errors, null, 2)).toHaveLength(0);
  const result = analyze(parsed.program);
  expect(result.errors, JSON.stringify(result.errors, null, 2)).toHaveLength(0);
  return result.iom.diagrams[0];
}

function fixture(name: string) {
  return readFileSync(join(process.cwd(), 'tests', 'fixtures', 'isx', name), 'utf8');
}

describe('codegen', () => {
  it('generates Python class boilerplate from IOM classes', () => {
    const diagram = classDiagram(`
diagram Shop : class {
  class Person {}
  interface Repository {
    +save(item: T): void
  }
  abstract class User extends Person implements Repository {
    -id: int
    +name: String = "guest"
    +email: String?
    +login(password: String): boolean
  }
}`);

    const output = generateCode(diagram, { language: 'python' });

    expect(output).toContain('from abc import ABC, abstractmethod');
    expect(output).toContain('class Repository(Protocol):');
    expect(output).toContain('def save(self, item: T) -> None:');
    expect(output).toContain('class User(Person, Repository, ABC):');
    expect(output).toContain('def __init__(self, id: int, name: str = "guest", email: Optional[str] = None):');
    expect(output).toContain('def login(self, password: str) -> bool:');
  });

  it('generates Java interfaces, enums, inheritance, implements, nullable hints, and constructors', () => {
    const diagram = classDiagram(`
diagram Billing : class {
  package billing {
    class Document {}
    enum Status { NEW PAID }
    interface Payable { +pay(amount: double): boolean }
    class Invoice<T> extends Document implements Payable {
      -id: String
      -status: Status = "NEW"
      +memo: String?
      +pay(amount: double): boolean
    }
  }
}`);

    const output = generateCode(diagram, { language: 'java' });

    expect(output).toContain('package billing;');
    expect(output).toContain('public enum Status');
    expect(output).toContain('NEW,');
    expect(output).toContain('public interface Payable');
    expect(output).toContain('boolean pay(double amount);');
    expect(output).toContain('public class Invoice<T> extends Document implements Payable');
    expect(output).toContain('private Status status = Status.NEW;');
    expect(output).toContain('@Nullable');
    expect(output).toContain('public Invoice(String id, Status status, String memo)');
  });

  it('generates a Java bundle with package file paths and one top-level type per file', () => {
    const diagram = classDiagram(fixture('codegen-billing-edge.isx'));

    const bundle = generateCodeBundle(diagram, { language: 'java' });

    expect(bundle.language).toBe('java');
    expect(bundle.files.map(file => file.path).sort()).toEqual([
      'billing/Amount.java',
      'billing/Invoice.java',
      'billing/Repository.java',
      'billing/Status.java',
    ]);
    expect(bundle.files.find(file => file.path === 'billing/Invoice.java')?.contents).toContain('package billing;');
    expect(bundle.files.find(file => file.path === 'billing/Invoice.java')?.contents).toContain('public class Invoice<T>');
    expect(bundle.files.find(file => file.path === 'billing/Invoice.java')?.contents).not.toContain('public enum Status');
  });

  it('maps generic, nullable, and default values for Java output', () => {
    const diagram = classDiagram(fixture('codegen-billing-edge.isx'));

    const invoice = generateCodeBundle(diagram, { language: 'java' }).files
      .find(file => file.path === 'billing/Invoice.java')?.contents ?? '';

    expect(invoice).toContain('private List<String> labels;');
    expect(invoice).toContain('@Nullable\n    private Integer retryCount;');
    expect(invoice).toContain('private boolean paid = false;');
    expect(invoice).toContain('private Status status = Status.NEW;');
    expect(invoice).toContain('public Invoice(List<String> labels, Integer retryCount, boolean paid, Status status)');
  });

  it('formats Java enums and distinguishes interface, abstract, and concrete methods', () => {
    const diagram = classDiagram(fixture('codegen-billing-edge.isx'));
    const bundle = generateCodeBundle(diagram, { language: 'java' });

    const status = bundle.files.find(file => file.path === 'billing/Status.java')?.contents ?? '';
    const repository = bundle.files.find(file => file.path === 'billing/Repository.java')?.contents ?? '';
    const amount = bundle.files.find(file => file.path === 'billing/Amount.java')?.contents ?? '';
    const invoice = bundle.files.find(file => file.path === 'billing/Invoice.java')?.contents ?? '';

    expect(status).toContain('NEW,\n    PAID,\n    VOIDED;');
    expect(repository).toContain('Optional<String> findName(String id);');
    expect(repository).not.toContain('abstract Optional<String> findName');
    expect(amount).toContain('public abstract double value();');
    expect(invoice).toContain('public boolean close() {\n        throw new UnsupportedOperationException("Not implemented yet");\n    }');
  });

  it('generates a Python module bundle with typing imports and Python generics', () => {
    const diagram = classDiagram(fixture('codegen-billing-edge.isx'));

    const bundle = generateCodeBundle(diagram, { language: 'python' });
    const module = bundle.files[0];

    expect(bundle.language).toBe('python');
    expect(module.path).toBe('billing.py');
    expect(module.contents).toContain('from typing import Generic, Optional, Protocol, TypeVar');
    expect(module.contents).toContain("T = TypeVar('T')");
    expect(module.contents).toContain('class Invoice(Generic[T], Repository):');
    expect(module.contents).toContain('def __init__(self, labels: list[str], retryCount: Optional[int] = None, paid: bool = False, status: Status = Status.NEW):');
    expect(module.contents).toContain('def findName(self, id: str) -> Optional[str]:');
  });
});
