import type { IOMDiagram, IOMEntity, IOMField, IOMMethod } from '../semantics/iom.js';

export type CodegenLanguage = 'python' | 'java';

export interface CodegenOptions {
  language: CodegenLanguage;
}

export interface CodegenFile {
  path: string;
  contents: string;
}

export interface CodegenBundle {
  language: CodegenLanguage;
  files: CodegenFile[];
  mainFile?: string;
}

export function generateCode(diagram: IOMDiagram, options: CodegenOptions): string {
  const entities = [...diagram.entities.values()].filter(entity =>
    ['class', 'interface', 'enum'].includes(entity.kind),
  );

  if (options.language === 'python') return generatePython(entities);
  return generateJava(entities);
}

export function generateCodeBundle(diagram: IOMDiagram, options: CodegenOptions): CodegenBundle {
  const entities = [...diagram.entities.values()].filter(entity =>
    ['class', 'interface', 'enum'].includes(entity.kind),
  );

  if (options.language === 'python') {
    const moduleName = bundleModuleName(diagram, entities);
    return {
      language: 'python',
      mainFile: `${moduleName}.py`,
      files: [{ path: `${moduleName}.py`, contents: generatePython(entities) }],
    };
  }

  const files = entities.map(entity => {
    const packagePath = entity.package ? `${entity.package.replace(/\./g, '/')}/` : '';
    const path = `${packagePath}${baseName(entity.name)}.java`;
    return { path, contents: renderJavaCompilationUnit(entity) };
  });
  return { language: 'java', mainFile: files[0]?.path, files };
}

function generatePython(entities: IOMEntity[]): string {
  const needsAbstract = entities.some(e => e.isAbstract || e.methods.some(m => m.isAbstract));
  const needsProtocol = entities.some(e => e.kind === 'interface');
  const needsEnum = entities.some(e => e.kind === 'enum');
  const needsOptional = entities.some(e =>
    [...e.fields.map(f => f.type), ...e.methods.flatMap(m => [m.returnType, ...m.params.map(p => p.type)])]
      .some(isNullableType),
  );
  const needsGeneric = entities.some(e => genericParams(e.name).length > 0);
  const typeVars = collectTypeVars(entities);
  const typingImports = [
    needsGeneric ? 'Generic' : undefined,
    needsOptional ? 'Optional' : undefined,
    needsProtocol ? 'Protocol' : undefined,
    typeVars.length ? 'TypeVar' : undefined,
  ].filter(Boolean).join(', ');
  const imports: string[] = [];
  if (needsAbstract) imports.push('from abc import ABC, abstractmethod');
  if (needsEnum) imports.push('from enum import Enum');
  if (typingImports) imports.push(`from typing import ${typingImports}`);

  const typeVarLines = typeVars.map(param => `${param} = TypeVar('${param}')`);
  const blocks = entities.map(entity => {
    if (entity.kind === 'enum') return renderPythonEnum(entity);
    if (entity.kind === 'interface') return renderPythonInterface(entity);
    return renderPythonClass(entity);
  });

  return [...imports, '', ...typeVarLines, '', ...blocks].join('\n\n').trim() + '\n';
}

function renderPythonEnum(entity: IOMEntity): string {
  const values = entity.enumValues.length > 0 ? entity.enumValues.map((v, i) => `    ${v.name} = ${i + 1}`) : ['    pass'];
  return [`class ${entity.name}(Enum):`, ...values].join('\n');
}

function renderPythonInterface(entity: IOMEntity): string {
  const bases = entity.extendsNames.length > 0 ? entity.extendsNames.join(', ') : 'Protocol';
  const lines = [`class ${entity.name}(${bases}):`];
  if (entity.methods.length === 0) lines.push('    pass');
  for (const method of entity.methods) lines.push(renderPythonMethod(method, false, true));
  return lines.join('\n');
}

function renderPythonClass(entity: IOMEntity): string {
  const params = genericParams(entity.name);
  const bases = [
    ...(params.length ? [`Generic[${params.join(', ')}]`] : []),
    ...entity.extendsNames.map(pythonBaseName),
    ...entity.implementsNames.map(pythonBaseName),
  ];
  if (entity.isAbstract && !bases.includes('ABC')) bases.push('ABC');
  const header = `class ${baseName(entity.name)}${bases.length ? `(${bases.join(', ')})` : ''}:`;
  const lines = [header];
  if (entity.fields.length > 0) lines.push(renderPythonConstructor(entity.fields));
  for (const method of entity.methods) lines.push(renderPythonMethod(method, method.isAbstract, false));
  if (lines.length === 1) lines.push('    pass');
  return lines.join('\n\n');
}

function renderPythonConstructor(fields: IOMField[]): string {
  const params = fields.map(field => {
    const pyType = pythonType(field.type);
    const defaultValue = field.defaultValue !== undefined
      ? pythonDefaultValue(field.type, field.defaultValue)
      : (isNullableType(field.type) ? 'None' : undefined);
    return `${field.name}: ${pyType}${defaultValue !== undefined ? ` = ${defaultValue}` : ''}`;
  });
  const lines = [`    def __init__(self${params.length ? `, ${params.join(', ')}` : ''}):`];
  for (const field of fields) lines.push(`        self.${field.name} = ${field.name}`);
  return lines.join('\n');
}

function renderPythonMethod(method: IOMMethod, abstractMethod: boolean, protocolMethod: boolean): string {
  const decorators = abstractMethod ? ['    @abstractmethod'] : [];
  const params = method.params.map(param => `${param.name}: ${pythonType(param.type)}`).join(', ');
  const returnType = pythonType(method.returnType);
  const body = (abstractMethod || protocolMethod) ? '        ...' : '        pass';
  return [...decorators, `    def ${method.name}(self${params ? `, ${params}` : ''}) -> ${returnType}:`, body].join('\n');
}

function generateJava(entities: IOMEntity[]): string {
  const packageName = entities.find(e => e.package)?.package;
  const blocks = entities.map(entity => {
    if (entity.kind === 'enum') return renderJavaEnum(entity);
    if (entity.kind === 'interface') return renderJavaInterface(entity);
    return renderJavaClass(entity);
  });
  const header = packageName ? `package ${packageName};\n\n` : '';
  return header + blocks.join('\n\n') + '\n';
}

function renderJavaCompilationUnit(entity: IOMEntity): string {
  const lines: string[] = [];
  if (entity.package) lines.push(`package ${entity.package};`, '');
  lines.push(...javaImports(entity));
  if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
  lines.push(
    entity.kind === 'enum'
      ? renderJavaEnum(entity)
      : entity.kind === 'interface'
        ? renderJavaInterface(entity)
        : renderJavaClass(entity),
  );
  return lines.join('\n').trim() + '\n';
}

function renderJavaEnum(entity: IOMEntity): string {
  if (entity.enumValues.length === 0) return `public enum ${baseName(entity.name)} {\n    VALUE;\n}`;
  const values = entity.enumValues.map((v, index) =>
    `    ${v.name}${index === entity.enumValues.length - 1 ? ';' : ','}`,
  );
  return [`public enum ${baseName(entity.name)} {`, ...values, '}'].join('\n');
}

function renderJavaInterface(entity: IOMEntity): string {
  const extendsText = entity.extendsNames.length ? ` extends ${entity.extendsNames.join(', ')}` : '';
  const methods = entity.methods.map(method => `    ${javaType(method.returnType, { returnType: true })} ${method.name}(${javaParams(method)});`);
  return [`public interface ${entity.name}${extendsText} {`, ...(methods.length ? methods : ['    // define contract here']), '}'].join('\n');
}

function renderJavaClass(entity: IOMEntity): string {
  const abstractText = entity.isAbstract ? 'abstract ' : '';
  const extendsText = entity.extendsNames.length ? ` extends ${entity.extendsNames[0]}` : '';
  const implementsText = entity.implementsNames.length ? ` implements ${entity.implementsNames.join(', ')}` : '';
  const lines = [`public ${abstractText}class ${entity.name}${extendsText}${implementsText} {`];
  for (const field of entity.fields) lines.push(renderJavaField(field));
  if (entity.fields.length > 0) lines.push('', renderJavaConstructor(entity));
  for (const method of entity.methods) lines.push('', renderJavaMethod(method));
  lines.push('}');
  return lines.join('\n');
}

function renderJavaField(field: IOMField): string {
  const nullable = isNullableType(field.type) ? '    @Nullable\n' : '';
  const finalText = field.isFinal ? 'final ' : '';
  const staticText = field.isStatic ? 'static ' : '';
  const defaultText = field.defaultValue !== undefined ? ` = ${javaDefaultValue(field.type, field.defaultValue)}` : '';
  return `${nullable}    ${visibilityJava(field.visibility)} ${staticText}${finalText}${javaType(field.type)} ${field.name}${defaultText};`;
}

function renderJavaConstructor(entity: IOMEntity): string {
  const params = entity.fields.map(field => `${javaType(field.type)} ${field.name}`).join(', ');
  const lines = [`    public ${baseName(entity.name)}(${params}) {`];
  for (const field of entity.fields) lines.push(`        this.${field.name} = ${field.name};`);
  lines.push('    }');
  return lines.join('\n');
}

function renderJavaMethod(method: IOMMethod): string {
  if (method.isAbstract) return `    ${visibilityJava(method.visibility)} abstract ${javaType(method.returnType, { returnType: true })} ${method.name}(${javaParams(method)});`;
  return `    ${visibilityJava(method.visibility)} ${javaType(method.returnType, { returnType: true })} ${method.name}(${javaParams(method)}) {\n        throw new UnsupportedOperationException(\"Not implemented yet\");\n    }`;
}

function javaParams(method: IOMMethod): string {
  return method.params.map(param => `${javaType(param.type)} ${param.name}`).join(', ');
}

function pythonType(type: string): string {
  const nullable = isNullableType(type);
  const core = nullable ? type.slice(0, -1) : type;
  const mapped = mapBaseType(core, {
    List: 'list',
    list: 'list',
    Map: 'dict',
    map: 'dict',
    Set: 'set',
    set: 'set',
    int: 'int',
    integer: 'int',
    double: 'float',
    float: 'float',
    boolean: 'bool',
    bool: 'bool',
    String: 'str',
    string: 'str',
    void: 'None',
  });
  return nullable ? `Optional[${mapped}]` : mapped;
}

function javaType(type: string, options: { returnType?: boolean } = {}): string {
  const nullable = isNullableType(type);
  const core = nullable ? type.slice(0, -1) : type;
  const mapped = mapBaseType(core, {
    List: 'List',
    list: 'List',
    Map: 'Map',
    map: 'Map',
    Set: 'Set',
    set: 'Set',
    int: 'int',
    integer: 'int',
    double: 'double',
    float: 'float',
    boolean: 'boolean',
    bool: 'boolean',
    String: 'String',
    string: 'String',
    void: 'void',
  }, javaType);
  if (!nullable) return mapped;
  const boxed = boxJavaType(mapped);
  return options.returnType && boxed !== 'void' ? `Optional<${boxed}>` : boxed;
}

function mapBaseType(
  type: string,
  map: Record<string, string>,
  nestedMapper: (type: string) => string = mapped => map[mapped] ?? mapped,
): string {
  const match = type.match(/^(\w+)<(.+)>$/);
  if (match) {
    const base = map[match[1]] ?? match[1];
    const args = splitGenericArgs(match[2]).map(arg => nestedMapper(arg.trim())).join(', ');
    const open = base[0] === base[0]?.toLowerCase() ? '[' : '<';
    const close = open === '[' ? ']' : '>';
    return `${base}${open}${args}${close}`;
  }
  return map[type] ?? type;
}

function isNullableType(type: string): boolean {
  return type.endsWith('?');
}

function visibilityJava(visibility: IOMField['visibility']): string {
  if (visibility === 'private') return 'private';
  if (visibility === 'protected') return 'protected';
  if (visibility === 'package') return '';
  return 'public';
}

function javaDefaultValue(type: string, value: string): string {
  const bare = value.replace(/^["']|["']$/g, '');
  if (/^[A-Z][A-Za-z0-9_]*$/.test(bare) && /^[A-Z][A-Za-z0-9_]*\??$/.test(type)) {
    return `${type.replace(/\?$/, '')}.${bare}`;
  }
  return value;
}

function pythonDefaultValue(type: string, value: string): string {
  const core = isNullableType(type) ? type.slice(0, -1) : type;
  if (value === 'true') return 'True';
  if (value === 'false') return 'False';
  if (/^[A-Z][A-Za-z0-9_]*$/.test(value) && /^[A-Z][A-Za-z0-9_]*\??$/.test(core)) {
    return `${core}.${value}`;
  }
  const bare = value.replace(/^["']|["']$/g, '');
  if (/^[A-Z][A-Za-z0-9_]*$/.test(bare) && /^[A-Z][A-Za-z0-9_]*\??$/.test(core)) {
    return `${core}.${bare}`;
  }
  if (/^(String|string)$/.test(core) && !/^["'].*["']$/.test(value)) return JSON.stringify(value);
  return value;
}

function baseName(name: string): string {
  return name.replace(/<.*>$/, '');
}

function pythonBaseName(name: string): string {
  return name.replace(/<.*>$/, '');
}

function genericParams(name: string): string[] {
  const match = name.match(/<(.+)>$/);
  return match ? splitGenericArgs(match[1]).map(param => param.trim()).filter(Boolean) : [];
}

function collectTypeVars(entities: IOMEntity[]): string[] {
  const vars = new Set<string>();
  for (const entity of entities) {
    for (const param of genericParams(entity.name)) vars.add(param);
  }
  return [...vars].sort();
}

function splitGenericArgs(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < args.length; i += 1) {
    const char = args[i];
    if (char === '<') depth += 1;
    if (char === '>') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(args.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(args.slice(start));
  return parts;
}

function boxJavaType(type: string): string {
  return {
    int: 'Integer',
    double: 'Double',
    float: 'Float',
    boolean: 'Boolean',
    bool: 'Boolean',
    long: 'Long',
    short: 'Short',
    byte: 'Byte',
    char: 'Character',
  }[type] ?? type;
}

function javaImports(entity: IOMEntity): string[] {
  const types = [
    ...entity.fields.map(field => field.type),
    ...entity.methods.flatMap(method => [method.returnType, ...method.params.map(param => param.type)]),
  ];
  const imports = new Set<string>();
  if (types.some(type => /\bList</.test(type))) imports.add('import java.util.List;');
  if (types.some(type => /\bMap</.test(type))) imports.add('import java.util.Map;');
  if (types.some(type => /\bSet</.test(type))) imports.add('import java.util.Set;');
  if (types.some(type => isNullableType(type))) imports.add('import java.util.Optional;');
  return [...imports].sort();
}

function bundleModuleName(diagram: IOMDiagram, entities: IOMEntity[]): string {
  const packageName = entities.find(entity => entity.package)?.package;
  return sanitizeModuleName(packageName ?? diagram.name);
}

function sanitizeModuleName(name: string): string {
  return name.replace(/\./g, '_').replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1').toLowerCase();
}
