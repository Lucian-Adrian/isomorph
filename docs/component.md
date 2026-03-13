Language Specification for the Unified Component Modeling Language (UCML)
1. Introduction and Scope
The architectural decomposition of complex software systems necessitates a rigorous modeling notation that bridges the gap between high-level logical abstractions and physical implementation artifacts. While the Object Management Group (OMG) provides the standardized Unified Modeling Language (UML), pedagogical environments and specific organizational standards often impose stricter constraints to ensure consistency, readability, and adherence to specific design methodologies. This document defines the formal language specification for the Unified Component Modeling Language (UCML), a Domain-Specific Language (DSL) engineered to satisfy a unique tripartite set of requirements: the "Teacher’s Core" constraints derived from specific academic mandates , the comprehensive metamodel of the OMG UML 2.5.1 specification , and the pragmatic syntax conventions of modern textual modeling tools.
This specification serves as the normative reference for language implementers, compiler engineers, and software architects. It defines the lexical structure, concrete grammar, abstract syntax tree (AST), semantic validation logic, and visual rendering rules required to transform textual descriptions into compliant Component Diagrams. The language is designed to be strictly typed regarding topological validity—enforcing specific connection rules between components and interfaces—while remaining flexible enough to capture advanced UML concepts such as ports, delegation connectors, and indirect instantiation.
The design philosophy of UCML prioritizes "Correctness by Construction." Unlike general-purpose UML tools that allow permissive linking between arbitrary classifiers, UCML integrates the "Teacher's Rules" as compile-time constraints. This ensures that any model successfully parsed by a UCML compiler is inherently compliant with the specific naming conventions and structural limitations mandated by the source educational materials, specifically regarding the exclusive nature of realization relationships and the linguistic properties of identifiers.
2. Normative References and Source Analysis
The construction of UCML is predicated on the resolution of conflicts and the synthesis of concepts from three primary sources. Understanding the precedence of these sources is vital for implementing the semantic analyzer of the DSL.
2.1. The "Teacher’s Core" Authority
The "Teacher's Core" refers to the set of mandatory constraints derived from the provided educational documentation: AMS_Partea_I_RO.doc and Regulile sintaxei Diagrama Componentelor.pdf. These documents establish the foundational axioms of the DSL. In the event of a conflict with standard UML permissiveness, the rules from these documents take precedence to satisfy the specific "Teacher" persona requirements.
Taxonomy of Components: Source explicitly categorizes components into specific stereotypes that must be supported as first-class citizens in the language: Libraries (.dll), Tables (.db), Files (.h, .cpp), Documents (.doc, .html), and Executables (.exe). The DSL must provide native keywords or standard library types for these.
Linguistic Determinism: Source imposes a unique constraint that couples the lexical form of an identifier with its semantic type. Specifically, the name of a component is mandated to be a noun ("substantiv"), and the name of an interface is mandated to strictly begin with the capital letter 'I' (e.g., IBancomat).
Topological Restriction: Perhaps the most significant constraint from is the restriction on the Realization relationship. While standard UML might allow broad usage of realization between classifiers, the Teacher's Core explicitly states: "Realization always is used to connect the Component with the Interface." Consequently, Component -> Component realization is a syntax error in UCML. Dependency relationships are similarly scoped to define correspondence between two or more components.
2.2. The OMG UML 2.5.1 Standard
To ensure the DSL is robust enough for professional use, the Teacher's Core is augmented with the OMG UML 2.5.1 specification. The Teacher's documents provide a simplified view (circa UML 1.x/2.0 transition), missing critical modern features. The UML spec fills these gaps:
Encapsulation: The concept of Ports is introduced to decouple internal structure from the environment.
Connectors: The distinction between Assembly and Delegation connectors is essential for composite structures.
Attributes: Metamodel properties such as isIndirectlyInstantiated are required to distinguish between design-time definitions and runtime entities.
2.3. Conflict Resolution Matrix
The following table establishes the behavior of the UCML compiler when standard UML rules intersect with Teacher constraints.
Feature Domain
UML 2.5.1 Standard
Teacher's Core
UCML Specification Strategy
Interface Naming
No Constraint.
Must start with 'I'.
Strict Enforcement: Regex validation ^I[A-Z].
Component Naming
No Constraint.
Must be a Noun.
Warning/Linting: NLP heuristic check; non-blocking warning.
Realization Link
Classifier to Classifier.
Component to Interface ONLY.
Strict Enforcement: Comp->Comp realization is a Compile Error.
Component Icon
Keyword or Icon in corner.
2-rectangles (UML 1.4) or Icon.
Hybrid: Supports both <<keyword>> and legacy visual rendering options.
Nesting
packagedElement property.
Implied via "Subsystems".
Full Support: Recursive nesting syntax allowed via braces {}.

3. Lexical Structure and Grammar
This section defines the formal grammar of UCML using a notation based on Extended Backus-Naur Form (EBNF). The lexical analyzer (lexer) must process the input stream into tokens defined below, discarding whitespace and comments.
3.1. Lexical Conventions
The language is case-sensitive. It supports Unicode characters in strings but restricts identifiers to ASCII alphanumeric characters to ensure cross-platform compatibility and strict adherence to the naming conventions.
Comments:
Single-line: Starts with // and continues to the end of the line.
Multi-line: Enclosed between /* and */.
Identifiers (<ID>): A sequence of letters, digits, and underscores, strictly starting with a letter.
String Literals (<STRING>): Enclosed in double quotes ". Used for descriptions, notes, and file paths.
Annotations: Metadata attached to elements, starting with @.
3.2. Reserved Keywords
The following words are reserved and cannot be used as identifiers:
component, interface, package, node, database, cloud, frame, port, provides, requires, realizes, depends, delegates, links, library, table, file, document, executable, true, false, static, dynamic.
3.3. Syntactic Grammar
The root of a UCML model is the Diagram node.
EBNF
Diagram ::= (Statement)*

Statement ::= ComponentDef

| InterfaceDef
| Relationship
| GroupingDef
| NoteDef
| StyleConfig

/* --- Component Definition --- */
ComponentDef ::= "component" ComponentID "{" ComponentBody "}"

| "component" ComponentID

ComponentID ::= <ID> /* Must pass Noun Heuristic Check */

Stereotype ::= "<<" StereotypeName ">>"
StereotypeName ::= "library" | "table" | "file" | "document" | "executable" | <ID>

ComponentBody ::= (MemberDef)*

MemberDef ::= AttributeDef

| OperationDef
| PortDef
| ComponentDef /* Nesting */
| ConstraintDef

/* --- Attributes & Operations (UML 2.5 Expansion) --- */
AttributeDef ::= Visibility PropertyName ":" Type [Multiplicity]
OperationDef ::= Visibility OpName "(" [ParamList] ")" ":" Type

Visibility ::= "+" | "-" | "#" | "~"
VisibilityKeyword ::= "public" | "private" | "protected" | "package"

/* --- Ports (UML 2.5 Expansion) --- */
PortDef ::= "port" PortName PortDirection
PortDirection ::= "provided" | "required" | "bi-directional"

/* --- Interface Definition --- */
InterfaceDef ::= "interface" InterfaceID "{" (OperationDef)* "}"

| "interface" InterfaceID

InterfaceID ::= "I" <ID> /* Regex: ^I[A-Z][a-zA-Z0-9_]* */

/* --- Relationships --- */
Relationship ::= SourceRef RelOp TargetRef [":" Label]

SourceRef ::= ElementRef ["." PortName]
TargetRef ::= ElementRef ["." PortName]

RelOp ::= "--|>"   /* Realization (Strict: Comp->Int) */

| "..>"    /* Dependency (Strict: Comp->Comp or Comp->Int) */
| "-->"    /* Delegation (Strict: Port->Part or Part->Port) */
| "--"     /* Assembly/Association */
| "-0)-"   /* Ball-and-Socket Assembly shorthand */

/* --- Grouping & Deployment --- */
GroupingDef ::= ("package" | "node" | "database" | "cloud" | "frame") GroupID "{" (Statement)* "}"


4. The Teacher’s Core: Mandatory Semantic Constraints
This section details the implementation of the constraints extracted from the uploaded documents. These are not merely syntactical preferences but hard semantic validation rules.
4.1. The Noun Constraint (Rule TC-01)
Source states: "Denumirea componentului întotdeauna va fi un substantiv" (The name of the component will always be a noun).
Rationale: This forces the modeler to think in terms of structural resources and entities (e.g., PaymentGateway, UserTable) rather than procedural actions (e.g., ProcessPayments, CalculateTax). This distinction is vital for component-based architecture vs. functional decomposition.
Validation Implementation:
The compiler must implement a heuristic check against the ComponentID.
Prohibited Patterns: Identifiers ending in "ing" (gerunds), starting with "Do", "Process", "Handle" (verbs).
Dictionary Check: If a dictionary is available, the token is checked against a noun list.
Failure Mode: Non-blocking Warning. (Blocking is impractical due to abbreviations/neologisms).
Example: component Calculating -> Warning: "Component names must be nouns."
4.2. The Interface Prefix Constraint (Rule TC-02)
Source states: "Denumirea interfeței va începe întotdeauna cu litera 'I'" (The name of the interface will always begin with the letter 'I').
Rationale: This adheres to the Hungarian notation convention common in COM and.NET architectures, ensuring immediate visual distinction between implementation (Component) and contract (Interface).
Validation Implementation:
Regex: ^I[A-Z].*
Failure Mode: Hard Compile Error.
Example: interface GPSReader -> Error: "Invalid Interface identifier 'GPSReader'. Interfaces must start with 'I' (e.g., 'IGPSReader')."
4.3. The Realization Topology Constraint (Rule TC-03)
Source explicitly restricts the Realization relationship: "Realizarea întotdeauna este utilizată pentru a conecta Componentul cu Interfața" (Realization is always used to connect the Component with the Interface).
Rationale: Standard UML allows realization between various Classifiers. However, for Component Diagrams in this context, Realization represents a specific "contract fulfillment." Connecting two components with Realization implies inheritance/implementation logic that confuses the architectural view (where Dependency or Assembly should be used).
Validation Implementation:
The Semantic Validator must resolve the types of the Source and Target symbols.
Condition: Type(Source) == Component AND Type(Target) == Interface.
Failure Mode: Hard Compile Error.
Example: ServerComponent --|> DatabaseComponent -> Error: "Illegal Realization. Realization must connect a Component to an Interface. Use Dependency (..>) or Association (--) instead."
4.4. Mandatory Stereotype Support (Rule TC-04)
Source lists specific component kinds that must be supported. The DSL implements these as built-in stereotypes that trigger specific rendering behaviors.
<<library>>: Static or dynamic libraries (.dll,.lib). Renders with a "books" or "DLL" decoration.
<table>: Database tables. Renders with a grid/table icon.
<<file>>: Source code artifacts. Renders with a "dog-eared page" icon.
<<document>>: General documentation.
<<executable>>: Runtime binaries. Renders with a "gear" or "binary" icon.
5. UML 2.5.1 Specification Expansion
To satisfy the requirement of a "Comprehensive" specification, UCML expands beyond the Teacher's Core to include essential elements from the OMG UML 2.5.1 standard. These elements allow for "White Box" modeling (internal structure) and more precise architectural definition.
5.1. Component Attributes and Properties
Standard UML Components are Classifiers and thus possess specific attributes. UCML exposes these attributes via the property keyword within the component body.
5.1.1. Indirect Instantiation (isIndirectlyInstantiated)
Definition: A boolean attribute from the UML metamodel. If true (default), the component is defined at design time but does not exist as a direct object at runtime; instead, artifacts or realizing classifiers are instantiated.
DSL Usage: property isIndirectlyInstantiated = false implies the component exists as a runtime entity (e.g., a specific singleton service).
Validation: Must be a boolean literal.
5.1.2. Packaged Elements (packagedElement)
Definition: Components can contain other classifiers (Classes, Interfaces, or other Components).
DSL Usage: Handled via the nested brace syntax {}. Scope rules dictate that elements defined inside a component are strictly owned by that component (Composition).
5.2. Port Definition and Semantics
Ports are critical for identifying interaction points on the boundary of a component. They allow a component to define its external contract without revealing its internal implementation.
DSL Syntax: port <name> : <InterfaceType> <direction>
Direction Semantics:
provided: The component offers the interface services. Renders as a Lollipop (Ball) on the component boundary.
required: The component needs this interface to function. Renders as a Socket on the boundary.
bi-directional: Complex ports handling two-way traffic.
5.3. Connector Types and Topology
UML 2.5.1 distinguishes between how components are wired. UCML strictly differentiates these to ensure the generated diagram accurately reflects architectural intent.
5.3.1. Assembly Connectors
Context: Wiring two components together to satisfy a dependency.
Logic: Connects a required interface (Socket) of Component A to a provided interface (Lollipop) of Component B.
Notation:
Ball-and-Socket: Visual merging of the symbols.
Solid Line: Explicit connection between ports.
DSL Syntax: CompA.portX -- CompB.portY or CompA --(0- CompB.
5.3.2. Delegation Connectors
Context: Wiring an external Port of a Component to an internal Part (nested component).
Logic:
Inbound Delegation: External provided port delegates to an internal component that actually implements the logic.
Outbound Delegation: Internal component's requirement is delegated to an external required port.
DSL Syntax: portX delegates internalComp.portY using the keyword delegates or the arrow --> inside the component scope.
Validation: Inbound delegation must link two compatible interfaces (e.g., both provided).
5.4. Visibility Modifiers
As Classifiers, components in UML 2.5 have visibility settings for their features. UCML supports standard text modifiers:
+ Public: Visible to all.
- Private: Visible only within the component.
# Protected: Visible to subclasses (Generalization).
~ Package: Visible within the same namespace.
6. Visual Rendering and Style Definition
A DSL specification must dictate how semantic elements map to visual primitives. This section defines the rendering rules based on the source documents and UML standards.
6.1. Component Rendering
Standard View: A rectangular classifier box. The keyword <<component>> or the specific stereotype (e.g., <<library>>) is displayed above the name.
Icon Decoration: A small component icon (two protruding rectangles on the left) is placed in the top-right corner.
Stereotype Icons:
<<table>>: Render a small grid/database icon in the top right.
<<file>>: Render a document icon.
Compartments:
Top: Name and Stereotypes.
Middle: Attributes and Internal Properties (if White Box view).
Bottom: Operations or Nested Artifacts.
6.2. Relationship Line Styles
The DSL compiler must output lines matching these styles:
Dependency: Dashed line, open arrow (V shape).
Realization: Dashed line, closed triangular arrowhead (hollow) pointing to Interface. OR Ball-and-Socket shorthand.
Delegation: Solid line, open arrow (indicating direction of signal flow).
Association/Assembly: Solid line, no arrow (or semantic direction arrow).
6.3. Interface Rendering
Lollipop: Used when a component provides an interface via a Port.
Socket: Used when a component requires an interface via a Port.
Classifier Rectangle: Used when interface is defined explicitly with operations.
7. Semantic Validation Logic (Compiler Implementation)
This section guides the implementation of the Semantic Analysis phase of the UCML compiler.
7.1. Symbol Table Construction
Pass 1: Traverse all component and interface definitions. Register names in the Global Scope or Nested Scopes.
Check: Duplicate definitions.
Check: Rule TC-01 (Noun) warnings.
Check: Rule TC-02 ('I' Prefix) errors.
Pass 2: Traverse all port definitions. Verify that referenced Interfaces exist in the Symbol Table.
7.2. Type Checking and Topology Validation
Pass 3 (Relationships): For every relationship statement:
Resolve Source and Target types.
Case realizes: Assert Type(Source) == Component and Type(Target) == Interface. Else: Error.
Case delegates:
Assert Parent(Source) == Parent(Target) (Must be within the same scope).
Assert directionality (Provided Port -> Internal Part Provided Port).
Pass 4 (Stereotypes): Warning if a custom stereotype is used that is not in the Teacher's approved list (library, table, etc.), though still allow it for extensibility.
8. Case Studies and Code Examples
The following examples demonstrate the DSL in action, highlighting how the syntax satisfies the requirements.
8.1. Scenario: Banking System (Addressing Teacher's Core)
This example models the ATM system referenced in the source documents, strictly adhering to the "I" prefix and Realization rules.
Fragment de cod
/* 
  System: ATM Banking
  Compliance: Mandatory Rules
*/

// Define Interfaces (Must start with I)
interface ICardReader {
    + readStrip() : String
    + ejectCard() : void
}

interface IBankNetwork {
    + authorizeTransaction(id: String, amount: float) : boolean
}

// Define Components (Nouns)
component ATMTerminal <<executable>> {
    // UML 2.5 Expansion: Attributes
    property isIndirectlyInstantiated = false
    property locationID : int = 101

    // UML 2.5 Expansion: Ports
    port cardSlot : ICardReader provided
    port uplink : IBankNetwork required

    // Internal Structure (Nesting)
    component CardDriver <<library>> {
        // Implementation details
    }
}

component BankServer <<table>> {
    // Attributes
    - connectionString : String
}

// Valid Relationships
// Rule TC-03: Component -> Interface Realization
ATMTerminal realizes ICardReader

// Rule TC-04: Component -> Component Dependency
ATMTerminal depends BankServer

// Edge Case: Wiring Ports
// Assembly connection using ball-and-socket logic
ATMTerminal.uplink -- BankServer.provided_interface

8.2. Scenario: Edge Cases and Error Handling
This example illustrates what constitutes invalid code in UCML.
Fragment de cod
// ERROR EXAMPLE

// Violation 1: Interface name does not start with 'I'
interface DataParser {... } 
// Compiler Output: Error: Interface 'DataParser' violates naming convention.

// Violation 2: Realization between two components
component Client
component Server
Client realizes Server
// Compiler Output: Error: Realization target must be an Interface.

// Violation 3: Verb used as Component Name (Warning)
component CalculateTax
// Compiler Output: Warning: Component name 'CalculateTax' appears to be a verb. Consider 'TaxCalculator'.

9. DSL Definition Summary Tables
9.1. Keyword Reference
Keyword
Context
Semantics
Constraint Source
component
Definition
Defines a structural unit.


interface
Definition
Defines a contract. Name must match ^I[A-Z].


port
Property
Defines an interaction point.


realizes
Relation
`Comp --
> Int`.
depends
Relation
Comp..> Element.


delegates
Relation
Port --> InternalPart.


library
Stereotype
Maps to .dll / shared obj.


table
Stereotype
Maps to database entity.



9.2. Relationship Matrix
Source
Target
Keyword
Symbol
Validity
Component
Interface
realizes
`--
>`
Component
Component
realizes
`--
>`
Component
Component
depends
..>
Valid
Port
Port
links
--
Valid (Assembly)
Port
Component
delegates
-->
Valid (Delegation)

10. Conclusion
The Unified Component Modeling Language (UCML) Specification successfully harmonizes the rigid pedagogical constraints of the provided "Teacher's Core" with the industrial-strength flexibility of UML 2.5.1. By enforcing strict naming conventions (Nouns, 'I' prefix) and relationship topologies (Restricted Realization) at the compiler level, UCML ensures that students and junior architects produce models that are theoretically sound according to their curriculum. Simultaneously, the inclusion of Ports, Delegation Connectors, and visibility attributes ensures that the language remains capable of modeling sophisticated, real-world distributed architectures. This specification provides a complete blueprint for the development of parsing tools, visualizers, and static analysis engines dedicated to high-integrity software architecture.

Data References: AMS_Partea_I_RO.doc (Teacher's Source A) Regulile sintaxei Diagrama Componentelor.pdf (Teacher's Source B) OMG UML 2.5.1 Specification (Metamodel & Attributes) UML Ports and Interfaces UML Connectors (Assembly vs Delegation) UML Visibility Standards Ball-and-Socket Notation