Comprehensive Language Specification for Unified Communication and Collaboration Modeling: A DSL Architecture Report
1. Architectural Vision and Domain Analysis
1.1 Introduction to the Domain Specific Language
The objective of this architectural report is to define a robust, rigorous, and logically consistent Domain Specific Language (DSL) tailored for the generation of UML Communication Diagrams (formerly known as Collaboration Diagrams in UML 1.x). This endeavor requires a sophisticated synthesis of pedagogical constraints—defined by a specific academic "Course Guide"—and the industrial-grade standards established by the Object Management Group (OMG) in the UML 2.5.1 Specification. The resulting language, tentatively named "CommLang," serves a dual purpose: it acts as a pedagogical tool that enforces strict syntactic rules (e.g., grammatical categories for naming conventions) while simultaneously functioning as a bridge to professional modeling practices by supporting advanced UML semantics.
Communication diagrams occupy a unique niche in the software modeling ecosystem. Unlike Sequence Diagrams, which emphasize the chronological ordering of messages along a strict time axis, Communication Diagrams emphasize the structural organization of the objects that send and receive those messages. They are essentially object diagrams overlaid with dynamic message flows. This distinction is critical for the architectural design of the DSL. The language must fundamentally prioritize the definition of a static graph topology (nodes and edges) before layering the dynamic behavioral semantics (sequenced messages) upon that topology. This architectural priority distinguishes CommLang from sequence diagram DSLs (like PlantUML’s sequence syntax), which often infer structure from the timeline.
1.2 The Evolution from Collaboration to Communication
To understand the "Teacher's Core" constraints properly, one must analyze the historical context. The Course Guide references "Collaboration Diagrams," a term prevalent in UML 1.x. In UML 2.0 and subsequent versions, including 2.5.1, this diagram type was renamed "Communication Diagram" to avoid confusion with the "Collaboration" model element (a structural definition of roles and interactions). However, the Course Guide retains the older terminology and specific structural entities like "Multiobject" and "Active Object" as distinct visual primitives.
This report treats the "Teacher's Core" as the primary requirements specification, representing a specialized subset of UML that emphasizes specific structural patterns often used in educational settings to teach Object-Oriented Analysis and Design (OOAD). The DSL will support these specific legacy elements as first-class citizens, ensuring backward compatibility with the curriculum, while mapping them internally to their UML 2.5.1 metamodel equivalents to ensure the tool is future-proof and professionally relevant.
1.3 Scope and Methodology
This language specification is constructed through a tripartite analysis:
Constraint Extraction: Rigorous parsing of the AMS_Partea_I_RO.doc and Regulile sintaxei Diagrama Colaborărilor.pdf to identify hard constraints, such as mandatory naming conventions (Nouns/Verbs) and specific visual notations.
Gap Analysis & Expansion: Cross-referencing these constraints against the OMG UML 2.5.1 specification to identify missing essential attributes (visibility, type safety, advanced relationship semantics) that are required for code generation and detailed architectural documentation.
Technical Implementation Definition: Synthesizing these requirements into a formal DSL grammar (EBNF-style) and defining the rendering logic, drawing inspiration from existing tools like PlantUML and Enterprise Architect but refining their syntax to enforce the specific constraints of the Course Guide.

2. The "Teacher's Core": Analysis of Primary Constraints
The "Teacher's Core" provides the foundational requirements for the DSL. These are not merely suggestions but rigid constraints that the DSL compiler must enforce. The analysis of the provided documentation reveals a strict pedagogical approach to modeling, distinguishing clearly between the Specification Level (architectural patterns) and the Instance Level (concrete runtime scenarios).
2.1 Mandatory Structural Elements (The Primitives)
The DSL must explicitly support the following object types. These are derived directly from Chapter 8 of the provided Word document and the PDF guide.
2.1.1 The Actor (Actor)
Definition: Represents a user or external system interacting with the subject system. The Course Guide specifies that an Actor represents the person using the application (e.g., "User", "Administrator").
Visual Constraint: Must be rendered as the standard "stick figure" icon.
Naming Constraint: The name must be a noun (Substantiv). This is a semantic rule that the DSL parser should ideally validate or warn against.
Source: Regulile sintaxei Diagrama Colaborărilor.pdf (Page 1) and AMS_Partea_I_RO.doc (Chapter 3.2, referenced in Chapter 8).
2.1.2 The Object (Obiect)
Definition: An instance of a class. The Course Guide emphasizes that objects represent "important parts of the system" such as Menus, Submenus, Interfaces, Systems, Databases, or Start Pages. This suggests a high-level architectural view rather than just low-level code objects.
Visual Constraint: A rectangle containing the name. The name is typically underlined to denote an instance (e.g., <u>Name : Class</u>).
Naming Constraint: The name must be a noun.
Source: Regulile sintaxei Diagrama Colaborărilor.pdf (Page 1) and AMS_Partea_I_RO.doc (Section 8.1).
2.1.3 The Multi-object (Multiobiect)
Definition: Describes a set of objects or a collection. This is a crucial distinction in the Teacher's Core (Section 8.1.1). It implies that a message sent to this element is either a broadcast to all elements in the set or a selection operation to retrieve a single element.
Visual Constraint: Two stacked rectangles, with the rear rectangle offset to create a "shadow" or "stack" effect.
Architectural Insight: Most modern text-to-diagram tools (like Mermaid) lack this specific primitive. Our DSL must treat multiobject as a distinct keyword to trigger this specific rendering logic.
Source: AMS_Partea_I_RO.doc (Section 8.1.1).
2.1.4 The Active Object (Obiect activ)
Definition: An object that owns a thread of control and can initiate activity (Section 8.1.2). Unlike passive objects that only react to messages, active objects drive the system flow.
Visual Constraint: A rectangle with a thick (bold) border.
Source: AMS_Partea_I_RO.doc (Section 8.1.2).
2.1.5 The Composite Object (Obiect compus)
Definition: An object that contains other objects (Section 8.1.3). This implies a strict containment hierarchy, often visualized as a large object rectangle containing smaller object rectangles within its boundaries.
DSL Implication: The DSL syntax must support nesting (scoping) to define these relationships hierarchically.
Source: AMS_Partea_I_RO.doc (Section 8.1.3).
2.1.6 The Collaboration (Colaborare)
Definition: Used at the "Specification Level" (as opposed to the Instance Level). It indicates a cooperative behavior or pattern between entities.
Visual Constraint: An ellipse (often with a dashed border in standard UML, though the file implies a specific use).
Naming Constraint: The name must be a verb. This distinguishes the abstract behavior (e.g., "ProcessingSale") from the structural entities.
Source: Regulile sintaxei Diagrama Colaborărilor.pdf (Page 2).
2.2 Mandatory Syntax and Linguistic Conventions
The PDF guide provides specific syntactic templates for message passing and naming that the DSL must implement verbatim.
Grammatical enforcement: The DSL error reporter must flag "Actor" names that are verbs (e.g., "Print") and "Collaboration" names that are nouns (e.g., "Printer"), adhering to the "Substantiv" vs. "Verb" rules.
Message Numbering: The guide mandates a numbering scheme (1, 1.1, 1.2) to denote sequence.
Synchronous Syntax: Defined as 1: <call>(). Note the usage of angle brackets and parentheses.
Asynchronous Syntax: Defined visually in the PDF but textually identical to synchronous in the simplified guide. The DSL must differentiate these via a property (e.g., async) to render the correct arrow head, even if the label syntax is similar.
Return Syntax: Explicitly defined as < 1: <call>(). The directionality is crucial here; the DSL must support a "reply" semantic that automatically reverses the arrow direction in the visual output.

3. The "UML Spec" Expansion: Filling the Semantic Gaps
The "Teacher's Core" provides a skeleton—a subset of valid UML. However, to function as a software engineering tool capable of code generation or detailed architectural documentation, we must flesh out this skeleton using the OMG UML 2.5.1 Specification. This section identifies the implicit requirements that are missing from the primary source but are essential for a complete implementation.
3.1 Expansion of Structural Attributes
The Teacher's Core mentions "Attributes" (4.1.2) and "Operations" (4.1.3) primarily in the context of Class Diagrams. However, in a robust Communication Diagram, objects often display their specific state values (slots) or the operations they expose.
3.1.1 Visibility Modifiers
The primary source does not explicitly detailing visibility syntax for diagram nodes, but standard UML requires it. To ensure the DSL is useful for detailed design, we must support standard visibility characters.
Public (+): Accessible to all elements.
Private (-): Accessible only to the defining class.
Protected (#): Accessible to subclasses.
Package (~): Accessible within the same package.
Recommendation: The DSL should allow these prefixes on attributes defined within an object block (e.g., + name: String).
3.1.2 Type Safety and Instance Specification
The primary source focuses on Name : Class syntax. The UML 2.5.1 spec (Section 11.4.3) defines specific notations for instances:
Named Instance: <u>myObject : ClassName</u>
Anonymous Instance: <u>: ClassName</u>
Orphan Instance: <u>myObject</u> (no class specified)
The DSL must support all three variations. Implicitly, the parser must handle optional parts of the Name : Type string.
3.2 Expansion of Relationship Semantics
The primary source lists generic "Associations" and specific "Link Types" (Association, Parameter, Local, Global, Self) in Section 8.2.1. These are actually Link End Stereotypes in UML terminology. We must formalize these in the DSL.
3.2.1 Standard UML Relationships
Dependency (..>): While the Teacher's Core focuses on Association, Dependency is critical for Communication Diagrams. It represents a transient relationship (e.g., an object passed as a parameter to a method). The DSL must support a dashed line style to represent this.
Realization (--|> or ..|>): If interfaces are used (mentioned in passing), the Realization link is needed to show that an Object implements an Interface.
Generalization (- |>): Explicitly required by the PDF at the Specification Level.
3.2.2 Link Stereotypes (From Teacher's Core 8.2.1 + UML Spec)
The DSL must allow users to tag links with the specific types mentioned in the primary source. These define why a link exists:
«parameter»: The supplier is passed as an argument to the client.
«local»: The supplier is a local variable within a method of the client.
«global»: The supplier is a global variable.
«self»: A reflexive link (object communicates with itself).
«association»: The default; a structural field reference.
3.3 Expansion of Message Semantics (Interaction)
The primary source uses a simplified message syntax. UML 2.5.1 (Chapter 17) provides a rigorous grammar for "Sequence Expressions" that the DSL should support to allow for complex modeling.
3.3.1 Iteration and Looping
The Teacher's Core does not explicitly detail loop syntax, but UML 2.5.1 is clear.
Syntax: *[iteration-clause]: messageName()
Visual: A star (*) followed by brackets.
DSL Requirement: The DSL must parse the * token to denote iteration.
3.3.2 Branching and Guards
Conditional execution is essential for logic.
Syntax: [guard-condition]: messageName()
Visual: Text in square brackets.
DSL Requirement: The DSL must support `` syntax to render guard conditions.
3.3.3 Parallel Execution
Communication diagrams can model concurrency.
Syntax: *||: messageName()
Visual: A star followed by double parallel lines.
DSL Requirement: This is vital for the "Active Object" interactions mentioned in the Teacher's Core.

4. The DSL Definition: The Code Structure
This section serves as the formal reference manual for the DSL. It defines the keywords, properties, and syntactic structures that the parser must recognize. The language is designed to be declarative, readable, and strictly typed regarding the "Teacher's Core" constraints.
4.1 Structural Entities
Entity: Actor
DSL Keyword: actor
Visual Style: Stick figure icon. Name below icon.
Mandatory Constraints: Name must be a Noun.
Properties:
name (string, required): The identifier.
alias (string, optional): A short reference for use in connections.
stereotype (string, optional): e.g., <<Human>>.
Connections: Can connect to object, multiobject, active_object, collaboration.
Entity: Object
DSL Keyword: object
Visual Style: Rectangle. Text format: <u>InstanceName : ClassName</u>.
Mandatory Constraints: Name must be a Noun.
Properties:
name (string, required): The instance name.
class (string, optional): The classifier name.
attributes (block, optional): List of visibility name : type.
Connections: Can connect to any other structural entity.
Entity: Multi-Object
DSL Keyword: multiobject
Visual Style: Two stacked rectangles (offset depth effect). Text is underlined.
UML Mapping: Maps to a Property with multiplicity * or 1..*.
Properties: Same as Object.
Logic: Represents a Collection/Set. Messages to this entity imply iteration or selection.
Entity: Active Object
DSL Keyword: active_object
Visual Style: Rectangle with thick (bold) borders. Text is underlined.
UML Mapping: Maps to an InstanceSpecification where the Classifier is an Active Class (isActive = true).
Properties: Same as Object.
Logic: Represents a process, thread, or controller.
Entity: Collaboration
DSL Keyword: collaboration
Visual Style: Ellipse with dashed border.
Mandatory Constraints: Name must be a Verb.
Context: Only valid in level: specification diagrams.
Properties: name (string).
Entity: Composite Object
DSL Keyword: composite_object or object... {... } (nesting syntax).
Visual Style: Large rectangle containing child elements.
Logic: Defines a nesting scope. Connections crossing the boundary interact with the parent.
4.2 Relationships and Connections
The DSL separates the definition of the link (the channel) from the messages (the data flowing through the channel).
Connection: Link (Association)
DSL Symbol: -- or -
Line Style: Solid line. No arrowheads (unless specifying navigability).
Properties:
type: association (default), parameter, local, global, self.
stereotype: e.g., <<parameter>>.
Syntax Example: User -- System or Controller - Database : <<local>>
Connection: Generalization
DSL Symbol: -|>
Line Style: Solid line.
Arrow Head: Closed, hollow triangle.
Context: Specification Level (Collaboration inheritance).
Syntax Example: ProcessSale -|> ProcessTransaction
Connection: Dependency
DSL Symbol: ..>
Line Style: Dashed line.
Arrow Head: Open stick arrow.
Syntax Example: View..> Controller
4.3 Message Syntax
Messages are attributes of a Link. The DSL attaches message flows to existing links.
Message Definition Syntax:
Sender -> Receiver : SequenceNumber : MessageSignature
Synchronous Message:
Symbol: ->
Arrow Head: Filled (Solid) Triangle.
Visual: Solid line along the link.
Asynchronous Message:
Symbol: ->>
Arrow Head: Open Stick Arrow.
Visual: Solid line along the link.
Return Message:
Symbol: <-- (or <-)
Arrow Head: Open Stick Arrow (often dashed line in UML 2, though Teacher's Core uses < prefix).
Logic: The DSL renderer handles the directionality automatically.
Sequence Expression Grammar:
The DSL must support the full UML 2.5 sequence string:
[Predecessor][Guard] SequenceExpression Signature
Iteration: * [i=1..n]
Parallel: *||
Example: 1.1 *[i=1..10]: processItem()

5. Edge Cases, Layout & Rendering Strategies
Implementing a Communication Diagram DSL presents specific challenges distinct from Sequence Diagrams. While Sequence Diagrams have a determined Y-axis (Time), Communication Diagrams are graphs where node placement is arbitrary but topological clarity is paramount.
5.1 Handling Nesting (Composite Objects)
The "Course Guide" references Composite Objects (8.1.3). This implies hierarchy.
DSL Syntax Approach: The DSL should support brace-based scoping.
composite_object MainWindow {
    object Toolbar;
    object Canvas;
    object StatusBar;
}


Rendering Logic: The layout engine must treat MainWindow as a container (subgraph). Toolbar, Canvas, and StatusBar must be rendered strictly within the bounding box of MainWindow. Links from external objects to Toolbar must cross the boundary of MainWindow.
5.2 Auto-Layout vs. Manual Positioning
Communication diagrams become unreadable if nodes overlap or lines cross excessively.
Constraint: The DSL should allow optional relative positioning hints (e.g., User left of System) to guide the force-directed graph algorithm.
Edge Routing: Links must be orthogonal or direct. Messages must be attached to these links. The critical rendering challenge is Message Stacking. If 5 messages pass between A and B, the renderer must stack them vertically (or offset them) along the link line, ensuring sequence numbers (1, 1.1, 1.2) are ordered visually from top to bottom or per standard reading direction.
5.3 Collision Avoidance for Labels
Message labels in Communication diagrams are long (e.g., 1.2.1: validateUser(id, pass)).
Strategy: The DSL renderer must implement a "text shield" or background masking for labels to prevent them from obscuring the link lines or other labels.
Directionality: Small arrowheads on the message label itself are required to show direction, as the link is non-directional. The DSL must automatically render a small arrow (e.g., ▸ or ◂) next to the text 1: msg() to indicate if the message flows A->B or B->A.
5.4 Self-Links
Section 8.2.1 mentions Self links.
DSL Syntax: ObjectA -- ObjectA
Rendering: This must be rendered as a loop (a curve exiting and entering the same node). Message labels for self-links must be placed radially around the loop.

6. Detailed Analysis of Provided Research Material
6.1 Analysis of "Regulile sintaxei Diagrama Colaborărilor.pdf"
This document is a primary constraint file. Key takeaways integrated into the report:
Nouns vs. Verbs: The explicit rule that Actors/Objects = Substantive and Collaborations = Verb is the most significant semantic constraint. This dictates the necessity of a validation layer in the DSL.
Specific Syntax: The usage of < for return messages is a specific notation that differs from the standard dashed arrow line style in some tools. The DSL must support this specific text marker 1.1: < returnVal or render it as a return message type.
Level Differentiation: The distinct separation into "Nivelul de exemple" (Instance) and "Nivelul de specificare" (Specification) mandates that the DSL likely needs a header declaration to switch modes (e.g., mode: instance vs mode: specification), as valid elements change between these modes.
6.2 Analysis of "AMS_Partea_I_RO.doc"
This document provides the definitions for the structural primitives.
Multiobject (8.1.1): The "stacking" visual is mandatory.
Active Object (8.1.2): The "thick border" is mandatory.
Composite Object (8.1.3): The nesting behavior is mandatory.
Link Types (8.2.1): The stereotypes parameter, local, etc., are explicitly listed and must be supported as link attributes.
6.3 UML 2.5.1 Specification (Secondary Source) Integration
Sequence Expressions: The UML spec (Section 17.12) defines the grammar for the sequence numbers. The DSL adopts this standard: Integer [. Integer]* [Letter].
Message Types: The spec distinguishes complete, lost, found, and unknown messages. While the Teacher's Core is simpler, the DSL should allow ? or * markers for lost/found messages to support advanced students or future course modules.
6.4 Complementary Tools Analysis
PlantUML: Uses a sequence-like syntax for communication diagrams but lacks a dedicated "Multiobject" keyword (users often fake it with multiple participant declarations or skinparams). It does not enforce Noun/Verb rules. Our DSL improves on this by having native structural keywords.
Mermaid: Currently lacks native Communication Diagram support (it relies on Sequence Diagrams). This DSL fills a significant gap in the open-source text-to-diagram ecosystem.
Enterprise Architect: A GUI tool that fully supports the UML spec including Collaboration Uses. However, it is not text-based. Our DSL brings EA's rigorous metamodel support to a text-based workflow.

7. Implementation Roadmap and Recommendations
To realize this language specification, the following engineering steps are recommended:
Tokenizer/Lexer: Develop a lexer capable of distinguishing distinct structural keywords (multiobject, active_object) from standard identifiers.
Parser with Validation: Implement a parser that not only builds the Abstract Syntax Tree (AST) but also runs the "Teacher's Constraints" validator (checking Noun/Verb usage via a dictionary look-up or heuristic).
Graphviz/Layout Engine: Integration with a layout engine (like Graphviz DOT) is recommended for the topology. The DSL compiler should translate the high-level CommLang syntax into DOT nodes and edges, calculating label positions to avoid overlap.
Extensibility: While the current constraints are strict, the DSL should allow a "strict: false" flag to bypass the Noun/Verb checks for professional use cases outside the classroom.
8. Conclusion
This report presents a comprehensive specification for a text-to-diagram DSL tailored to the creation of UML Communication Diagrams. By strictly adhering to the "Teacher's Core" constraints—specifically the naming conventions and specific element types like Multiobjects—while scaffolding the missing logical components with the OMG UML 2.5.1 Specification, we define a language that is both pedagogically compliant and professionally robust. The proposed "CommLang" fills a distinct gap in the current tooling landscape, offering native support for structural communication modeling that existing tools like Mermaid or PlantUML either approximate or lack.
Table 1: Feature Compliance Matrix
Feature
Source
DSL Implementation Strategy
Actor/Object Noun Rule
Teacher's Core (PDF)
Compiler Warning/Error Validator
Collaboration Verb Rule
Teacher's Core (PDF)
Compiler Warning/Error Validator
Multiobject Visualization
Teacher's Core (Doc 8.1.1)
Native Keyword multiobject, Stacked Rendering
Active Object Visualization
Teacher's Core (Doc 8.1.2)
Native Keyword active_object, Thick Border
Link Stereotypes
Teacher's Core (Doc 8.2.1)
Link Properties (e.g., <<local>>)
Nested Objects
Teacher's Core (Doc 8.1.3)
Scoped Block Syntax {... }
Iteration/Guards
UML 2.5.1 Spec
Message Attributes *, ``
Dependency Links
UML 2.5.1 Spec
Dashed Line Syntax ..>

This specification stands ready for the next phase of development: the creation of a formal grammar file (e.g., Antlr4 or Xtext) and the corresponding rendering backend.
