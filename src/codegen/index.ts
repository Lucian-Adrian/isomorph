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
    return { path, contents: renderJavaCompilationUnit(entity, entities) };
  });
  return { language: 'java', mainFile: files[0]?.path, files };
}

function collectInheritedFields(entity: IOMEntity, entities: IOMEntity[]): IOMField[] {
  const inherited: IOMField[] = [];
  const visited = new Set<string>();

  function recurse(currentName: string) {
    const simpleName = baseName(currentName);
    if (visited.has(simpleName)) return;
    visited.add(simpleName);

    const parent = entities.find(e => baseName(e.name) === simpleName && e.kind === 'class');
    if (!parent) return;

    for (const ext of parent.extendsNames) {
      recurse(ext);
    }

    for (const field of parent.fields) {
      if (!inherited.some(f => f.name === field.name)) {
        inherited.push(field);
      }
    }
  }

  for (const ext of entity.extendsNames) {
    recurse(ext);
  }

  return inherited;
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
    return renderPythonClass(entity, entities);
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

function renderPythonClass(entity: IOMEntity, entities: IOMEntity[]): string {
  const params = genericParams(entity.name);
  const bases = [
    ...entity.extendsNames.map(pythonBaseName),
    ...entity.implementsNames.map(pythonBaseName),
    ...(params.length ? [`Generic[${params.join(', ')}]`] : []),
  ];
  if (entity.isAbstract && !bases.includes('ABC')) bases.push('ABC');
  const header = `class ${baseName(entity.name)}${bases.length ? `(${bases.join(', ')})` : ''}:`;
  const lines = [header];
  const constructorStr = renderPythonConstructor(entity, entities);
  if (constructorStr) lines.push(constructorStr);
  const methods = [...entity.methods, ...implementedInterfaceMethods(entity, entities, entity.methods)];
  for (const method of methods) lines.push(renderPythonMethod(method, method.isAbstract, false));
  if (lines.length === 1) lines.push('    pass');
  return lines.join('\n\n');
}

function renderPythonConstructor(entity: IOMEntity, entities: IOMEntity[]): string {
  const inheritedFields = collectInheritedFields(entity, entities);
  const ownFields = entity.fields;
  const allFields = [...inheritedFields, ...ownFields];
  if (allFields.length === 0) return '';

  const isDefault = (field: IOMField) => field.defaultValue !== undefined || isNullableType(field.type);
  const nonDefaultFields = allFields.filter(f => !isDefault(f));
  const defaultFields = allFields.filter(f => isDefault(f));
  const sortedFields = [...nonDefaultFields, ...defaultFields];

  const params = sortedFields.map(field => {
    const pyType = pythonType(field.type);
    const defaultValue = field.defaultValue !== undefined
      ? pythonDefaultValue(field.type, field.defaultValue)
      : (isNullableType(field.type) ? 'None' : undefined);
    return `${field.name}: ${pyType}${defaultValue !== undefined ? ` = ${defaultValue}` : ''}`;
  });
  const lines = [`    def __init__(self${params.length ? `, ${params.join(', ')}` : ''}):`];
  if (entity.extendsNames.length > 0) {
    const parentArgs = inheritedFields.map(f => f.name).join(', ');
    lines.push(`        super().__init__(${parentArgs})`);
  }
  for (const field of ownFields) {
    lines.push(`        self.${field.name} = ${field.name}`);
  }
  return lines.join('\n');
}

function renderPythonMethod(method: IOMMethod, abstractMethod: boolean, protocolMethod: boolean): string {
  const decorators = abstractMethod ? ['    @abstractmethod'] : [];
  const params = method.params.map(param => `${param.name}: ${pythonType(param.type)}`).join(', ');
  const returnType = pythonType(method.returnType);
  const body = (abstractMethod || protocolMethod) ? '        ...' : `        ${pythonDefaultReturnStatement(method.returnType)}`;
  return [...decorators, `    def ${method.name}(self${params ? `, ${params}` : ''}) -> ${returnType}:`, body].join('\n');
}

function generateJava(entities: IOMEntity[]): string {
  const packageName = entities.find(e => e.package)?.package;
  const blocks = entities.map(entity => {
    if (entity.kind === 'enum') return renderJavaEnum(entity);
    if (entity.kind === 'interface') return renderJavaInterface(entity);
    return renderJavaClass(entity, entities);
  });
  const header = packageName ? `package ${packageName};\n\n` : '';
  const imports = [...new Set(entities.flatMap(entity => javaImports(entity, entities)))].sort();
  const importBlock = imports.length ? `${imports.join('\n')}\n\n` : '';
  return header + importBlock + blocks.join('\n\n') + '\n';
}

function renderJavaCompilationUnit(entity: IOMEntity, entities: IOMEntity[]): string {
  const lines: string[] = [];
  if (entity.package) lines.push(`package ${entity.package};`, '');
  lines.push(...javaImports(entity, entities));
  if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
  lines.push(
    entity.kind === 'enum'
      ? renderJavaEnum(entity)
      : entity.kind === 'interface'
        ? renderJavaInterface(entity)
        : renderJavaClass(entity, entities),
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

function renderJavaClass(entity: IOMEntity, entities: IOMEntity[]): string {
  const abstractText = entity.isAbstract ? 'abstract ' : '';
  const extendsText = entity.extendsNames.length ? ` extends ${entity.extendsNames[0]}` : '';
  const implementsText = entity.implementsNames.length ? ` implements ${entity.implementsNames.join(', ')}` : '';
  const lines = [`public ${abstractText}class ${entity.name}${extendsText}${implementsText} {`];
  for (const field of entity.fields) lines.push(renderJavaField(field));
  if (entity.fields.length > 0 || collectInheritedFields(entity, entities).length > 0) {
    lines.push('', renderJavaConstructor(entity, entities));
  }
  const methods = [...entity.methods, ...implementedInterfaceMethods(entity, entities, entity.methods)];
  for (const method of methods) lines.push('', renderJavaMethod(method));
  lines.push('}');
  return lines.join('\n');
}

function renderJavaField(field: IOMField): string {
  const finalText = field.isFinal ? 'final ' : '';
  const staticText = field.isStatic ? 'static ' : '';
  const defaultText = field.defaultValue !== undefined ? ` = ${javaDefaultValue(field.type, field.defaultValue)}` : '';
  return `    ${visibilityJava(field.visibility)} ${staticText}${finalText}${javaType(field.type)} ${field.name}${defaultText};`;
}

function renderJavaConstructor(entity: IOMEntity, entities: IOMEntity[]): string {
  const inheritedFields = collectInheritedFields(entity, entities);
  const ownFields = entity.fields;
  const allFields = [...inheritedFields, ...ownFields];
  const params = allFields.map(field => `${javaType(field.type)} ${field.name}`).join(', ');
  const lines = [`    public ${baseName(entity.name)}(${params}) {`];
  if (entity.extendsNames.length > 0) {
    const parentArgs = inheritedFields.map(f => f.name).join(', ');
    lines.push(`        super(${parentArgs});`);
  }
  for (const field of ownFields) {
    lines.push(`        this.${field.name} = ${field.name};`);
  }
  lines.push('    }');
  return lines.join('\n');
}

function renderJavaMethod(method: IOMMethod): string {
  if (method.isAbstract) return `    ${visibilityJava(method.visibility)} abstract ${javaType(method.returnType, { returnType: true })} ${method.name}(${javaParams(method)});`;
  const returnType = javaType(method.returnType, { returnType: true });
  const returnStatement = javaDefaultReturnStatement(method.returnType, returnType);
  const body = returnStatement ? `\n        ${returnStatement}\n    ` : '\n    ';
  return `    ${visibilityJava(method.visibility)} ${returnType} ${method.name}(${javaParams(method)}) {${body}}`;
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

function javaDefaultReturnStatement(sourceType: string, renderedType: string): string {
  if (renderedType === 'void') return '';
  if (isNullableType(sourceType) && renderedType.startsWith('Optional<')) return 'return Optional.empty();';
  if (renderedType === 'boolean') return 'return false;';
  if (renderedType === 'char') return "return '\\0';";
  if (renderedType === 'double' || renderedType === 'float') return 'return 0.0;';
  if (['byte', 'short', 'int', 'long'].includes(renderedType)) return 'return 0;';
  return 'return null;';
}

function pythonDefaultReturnStatement(sourceType: string): string {
  const renderedType = pythonType(sourceType);
  if (renderedType === 'None') return 'pass';
  if (isNullableType(sourceType) || renderedType.startsWith('Optional[')) return 'return None';
  if (renderedType === 'bool') return 'return False';
  if (renderedType === 'int') return 'return 0';
  if (renderedType === 'float') return 'return 0.0';
  if (renderedType === 'str') return "return ''";
  if (renderedType.startsWith('list[') || renderedType === 'list') return 'return []';
  if (renderedType.startsWith('dict[') || renderedType === 'dict') return 'return {}';
  if (renderedType.startsWith('set[') || renderedType === 'set') return 'return set()';
  return 'return None';
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

function javaImports(entity: IOMEntity, entities: IOMEntity[]): string[] {
  const types = [
    ...entity.fields.map(field => field.type),
    ...[
      ...entity.methods,
      ...implementedInterfaceMethods(entity, entities, entity.methods),
    ].flatMap(method => [method.returnType, ...method.params.map(param => param.type)]),
  ];
  const imports = new Set<string>();
  if (types.some(type => /\bList</.test(type))) imports.add('import java.util.List;');
  if (types.some(type => /\bMap</.test(type))) imports.add('import java.util.Map;');
  if (types.some(type => /\bSet</.test(type))) imports.add('import java.util.Set;');
  if ([...entity.methods, ...implementedInterfaceMethods(entity, entities, entity.methods)].some(method => isNullableType(method.returnType))) {
    imports.add('import java.util.Optional;');
  }
  return [...imports].sort();
}

function implementedInterfaceMethods(entity: IOMEntity, entities: IOMEntity[], ownMethods: IOMMethod[]): IOMMethod[] {
  if (entity.kind !== 'class' || entity.implementsNames.length === 0) return [];
  const methods = new Map(ownMethods.map(method => [methodSignatureKey(method), method]));
  const interfaceMethods = entity.implementsNames.flatMap(name => collectInterfaceMethods(name, entities));
  const missing: IOMMethod[] = [];
  for (const method of interfaceMethods) {
    const key = methodSignatureKey(method);
    if (methods.has(key)) continue;
    methods.set(key, method);
    missing.push({ ...method, isAbstract: false });
  }
  return missing;
}

function collectInterfaceMethods(name: string, entities: IOMEntity[], seen = new Set<string>()): IOMMethod[] {
  const simpleName = baseName(name);
  if (seen.has(simpleName)) return [];
  seen.add(simpleName);
  const entity = entities.find(candidate => baseName(candidate.name) === simpleName && candidate.kind === 'interface');
  if (!entity) return [];
  return [
    ...entity.methods,
    ...entity.extendsNames.flatMap(parent => collectInterfaceMethods(parent, entities, seen)),
  ];
}

function methodSignatureKey(method: IOMMethod): string {
  return `${method.name}(${method.params.map(param => param.type).join(',')})`;
}

function bundleModuleName(diagram: IOMDiagram, entities: IOMEntity[]): string {
  const packageName = entities.find(entity => entity.package)?.package;
  return sanitizeModuleName(packageName ?? diagram.name);
}

function sanitizeModuleName(name: string): string {
  return name.replace(/\./g, '_').replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1').toLowerCase();
}
