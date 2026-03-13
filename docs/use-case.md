Language Specification for UseCaseDSL: A Hybrid Metamodel Approach
1. Executive Summary and Architectural Vision
This document constitutes the formal Language Specification for UseCaseDSL, a specialized textual modeling language designed to generate UML Use Case diagrams. The architecture of this language is unique in its dual-mandate design: it must rigorously enforce a specific set of pedagogical constraints defined in the provided "Course Guide" (the Teacher's Core) while simultaneously adhering to the structural and semantic definitions of the OMG Unified Modeling Language (UML) Specification Version 2.5.1 (the Standard).
The development of this DSL addresses a critical gap in current modeling tooling. Existing tools like PlantUML, Mermaid, and Enterprise Architect offer broad flexibility but lack the strict syntactic enforcement required for educational environments where adherence to specific conventions (e.g., "Use Case names must be verbs with maximum 3 words") is a grading criterion. Conversely, the "Course Guide" defines a simplified subset of UML that is insufficient for implementation; it omits essential metamodel attributes (such as visibility, abstract classifiers, and extension points) necessary for code generation and robust model interchange.
This specification bridges these worlds. It synthesizes the mandatory constraints of the primary source with the gap-filling richness of the secondary UML source, validated against the implementation realities of complementary tools. The result is a DSL that is syntactically strict, semantically rich, and capable of generating professional-grade diagrams that satisfy both the instructor's rules and international software engineering standards.
1.1 Methodology of Synthesis
The specification is constructed through a tiered analysis:
Tier 1: Constraint Enforcement (The Teacher's Core). This layer defines the validation logic of the DSL compiler. Violations of these rules—such as naming an Actor with a verb or connecting two actors with an association—are treated as critical syntax errors.
Tier 2: Metamodel Expansion (The UML Spec). This layer defines the internal data structure. Where the Course Guide is silent (e.g., on the concept of "abstract actors" or "attribute visibility"), the DSL adopts the UML 2.5.1 standard default. This ensures the DSL is forward-compatible.
Tier 3: Visual Realization (Tooling Benchmarks). This layer defines the rendering logic. It draws on established conventions from PlantUML and Mermaid to ensure the generated diagrams are legible, familiar, and visually coherent.

2. The "Teacher's Core": Analysis of Mandatory Constraints
The "Teacher's Core" is the normative foundation of this DSL. Unlike standard UML tools which are permissive (allowing users to model incorrectly if they choose), UseCaseDSL acts as a "linting compiler," actively preventing the creation of diagrams that violate the course's pedagogical rules. This section details the mandatory elements and the specific syntax rules extracted from the primary source.
2.1 Mandatory Elements and Definitions
The following entities are explicitly required by the Course Guide. Their presence in the DSL is non-negotiable, and their definitions are constrained by the specific definitions provided in the source text.
2.1.1 Actor (Actori)
Definition: The Course Guide defines an Actor broadly as representing "both the person working with the system (application) (e.g., User, Administrator) and the system in general, or certain parts of the system (e.g., ATM System, Computer System, Database)".
Constraint Checklist:
Must be an external entity.
Must be capable of interacting with Use Cases.
Can represent humans or non-human systems.
2.1.2 Use Case (Cazul de utilizare)
Definition: A Use Case represents "a function performed by the system (application)".
Constraint Checklist:
Must represent a discrete unit of functionality.
Must be connectable to Actors and other Use Cases.
2.1.3 Boundary (System Boundary)
Definition: The Boundary "has the purpose of grouping certain functionalities of the system into a whole".
Constraint Checklist:
Must act as a container for Use Cases.
Implies a visual separation between internal functionality (Use Cases) and external entities (Actors).
2.1.4 Package (Pachetul)
Definition: The Package "offers the possibility to divide the system into component parts".
Constraint Checklist:
Must function as a grouping mechanism, distinct from the System Boundary.
Likely used for logical organization (e.g., "Admin Module", "User Module").
2.1.5 Note (Notă)
Definition: A mechanism that "allows commenting on any entity on the diagram".
Constraint Checklist:
Must be attachable to Actors, Use Cases, or the diagram canvas.
2.2 Mandatory Syntax and Naming Conventions
The primary source imposes strict naming conventions that function as semantic validators. The DSL parser must implement lexical analysis capable of distinguishing parts of speech to enforce these rules.
Element
Naming Convention (Mandatory)
Validation Logic Implication
Actor
Must be a Noun (Substantiv).
The compiler requires a dictionary look-up or integration with a lightweight NLP library (e.g., WordNet) to flag names like "Run" or "Saving" as invalid for Actors.
Use Case
Must be a Verb (Infinitive/Conjugated).
The compiler must enforce that the first token of the string is a verb (e.g., "Create", "Manage").
Use Case
Maximum 3 words.
The tokenizer must split the name string by whitespace. If token_count > 3, a specific error "ERR_UC_LENGTH: Use Case name exceeds 3 words" must be thrown.
Boundary
Must be a Noun.
Similar validation to Actors.
Package
Must be a Noun.
Similar validation to Actors.

2.3 Mandatory Relationship Rules
The allowed topology of the diagram is strictly limited by the Course Guide. Standard UML permits a wide variety of connections (e.g., dependencies between Actors), but this DSL must restrict valid connections to the following matrix.
2.3.1 Bidirectional Association (Asocierea bidirecțională)
Valid Connection: Actor $\longleftrightarrow$ Use Case.
Visual Syntax: A solid line with no arrowheads.
Constraint: The guide explicitly states "Bidirectional," implying that directed associations (Actor $\rightarrow$ Use Case) often used to denote "primary actor" status in standard UML are not the default or enforced style here. The DSL must render a plain line.
2.3.2 Dependency (Dependenţa)
Valid Connection:
Actor $\dashrightarrow$ Actor
Use Case $\dashrightarrow$ Use Case.
Visual Syntax: Dashed line with an open arrow.
Semantics: Represents a generic dependency where one element relies on another.
2.3.3 Generalization (Generalizarea / Moştenirea)
Valid Connection:
Actor $\longrightarrow$ Actor (Child to Parent).
Use Case $\longrightarrow$ Use Case (Child to Parent).
Cardinality Constraint: The guide specifies it "can be utilized between at least 3 Actors or between at least 3 Use Cases".
Implication: This is a highly specific pedagogical rule designed to prevent trivial inheritance. The DSL compiler must build an inheritance graph in memory. During the validation phase, it must count the nodes in any connected inheritance component. If a component has fewer than 3 nodes (e.g., just a single Child and Parent), it must trigger a warning: "WARN_GEN_COUNT: Generalization hierarchies must involve at least 3 elements."
2.3.4 Include (<<include>>)
Valid Connection: Base Use Case $\dashrightarrow$ Included Use Case.
Directionality: From Base to Included.
Semantics: Defined as a mandatory function ("funcție obligatorie").
Visual Syntax: Dashed line, open arrow, labeled with stereotype <<include>>.
2.3.5 Extend (<<extend>>)
Valid Connection: Extension Use Case $\dashrightarrow$ Base Use Case.
Directionality: From Extension (Child) to Base. The guide explicitly notes this is "inverse as direction to the Include relationship".
Semantics: Defined as an optional function ("funcție opțională").
Visual Syntax: Dashed line, open arrow, labeled with stereotype <<extend>>.

3. The "UML Spec" Expansion (The Missing Pieces)
While Section 2 defines the constraints, it lacks the detailed attributes required to implement the objects in code. A Use Case in a software tool cannot just be a "name"; it needs state, visibility, and specific meta-attributes. We draw upon the OMG UML 2.5.1 Specification to define these missing pieces, ensuring the DSL is robust enough to support standard UML features if the user chooses to enable them (Advanced Mode).
3.1 Expansion of Element Attributes
In the UML 2.5.1 Metamodel, both Actors and Use Cases are specializations of BehavioredClassifier, which itself is a Classifier. This inheritance hierarchy grants them specific attributes that the DSL must support to be compliant.
3.1.1 Visibility Attributes (Missing from Course Guide)
The Course Guide does not mention visibility, but in a modeling tool, users may need to define whether a Use Case is public (part of the API) or private (internal logic).
Standard UML Attribute: visibility (type: VisibilityKind).
DSL Support: The DSL should support the standard character prefixes to define this property, defaulting to public if unspecified.
+ Public (visible to all).
- Private (visible only inside namespace).
# Protected (visible to children).
~ Package (visible to package).
Rationale: Supporting visibility allows the DSL to be used for detailed design documents where access control matters, without violating the simpler constraints of the Course Guide.
3.1.2 Abstract Classifiers (Missing from Course Guide)
The "Rule of 3" for generalization implies the existence of abstract parent Use Cases or Actors (elements that exist solely to be inherited from and are never instantiated).
Standard UML Attribute: isAbstract (type: Boolean).
DSL Support: The DSL must include an abstract keyword.
Visual Rendering: Per UML 2.5.1, the name of an abstract element must be rendered in italics. The DSL renderer must implement this font style change automatically when the property is set.
3.1.3 Leaf Classifiers (Missing from Course Guide)
To prevent further specialization (e.g., "This is the final specific Actor"), UML uses the leaf property.
Standard UML Attribute: isLeaf (type: Boolean).
DSL Support: The DSL should support a final or leaf keyword.
Rationale: This allows the "Rule of 3" validator to know when a hierarchy branch is intentionally terminated.
3.2 Expansion of Relationship Semantics
3.2.1 Multiplicity on Associations (Missing from Course Guide)
The Course Guide describes "Bidirectional Association" but ignores cardinality. In real-world systems, defining how many actors interact with a system (e.g., "1 User can have 0..* Sessions") is critical.
Standard UML Attribute: multiplicity (type: UnlimitedNatural).
Notation: Text strings like 1, 0..1, 1..*, * placed at the ends of the association line.
DSL Support: The DSL must allow optional quoted strings at both ends of a connection definition to specify these values.
Example: User "1" -- "0..*" Login
3.2.2 Extension Points (Crucial Missing Piece)
The Course Guide mandates the <<extend>> relationship but omits the Extension Point. In UML 2.5.1, an extend relationship is invalid if it does not reference a specific point in the base Use Case where the behavior is inserted.
Standard UML Definition: "An ExtensionPoint identifies a point in the behavior of a UseCase where that behavior can be extended... An ExtensionPoint must have a name".
Visual Notation: A list in a compartment inside the Use Case oval, or a note attached to the relationship.
DSL Support: The DSL must provide a syntax block inside the Use Case definition to list extension points.
Syntax: point: <name>
Rationale: Without this, the <<extend>> arrow is semantically ambiguous.
3.2.3 The "Subject" vs. "Boundary" Terminology
The Course Guide uses "Boundary". UML 2.5.1 formally refers to the system under design as the Subject.
Resolution: The DSL will prioritize the teacher's vocabulary (boundary) as the primary keyword but will internally map this to the UML Subject metaclass.
Visual Notation Update: UML 2.5 requires the name of the Subject to be in the top-left corner of the rectangle. Older tools placed it centered. The DSL renderer must follow the modern 2.5.1 standard to be compliant.
3.2.4 Realization (Interface Implementation)
Use Cases often realize Interfaces (groupings of operations). While not in the Course Guide, this is standard in component-based Use Case modeling.
DSL Support: Support the ..|> arrow style (dashed line, closed hollow arrow) to denote Realization. This allows "Advanced" users to link Use Cases to the logical interfaces they implement.

4. The DSL Definition (The Code Structure)
This section defines the formal grammar of UseCaseDSL. It is designed to be parsed by a standard lexer/parser (e.g., ANTLR) and compiled into a visual representation (e.g., via Graphviz DOT or Elk). The syntax borrows structurally from PlantUML for familiarity but imposes strict typing to support the Course Guide's validation rules.
4.1 Global Grammar Rules
Case Insensitivity: Keywords (e.g., Actor, UseCase) are case-insensitive. Identifiers are case-sensitive.
Strings: Multi-word names must be enclosed in double quotes. Single-word names can be unquoted.
Comments: Lines beginning with // or # are ignored.
4.2 Entity Specifications
Entity: Actor
DSL Keyword: actor
Mandatory Syntax: actor <Name> [as <Alias>]
Validation Rule: Name must be a Noun. (Parser warning if Verb detected).
Visual Style:
Shape: Stick Man.
Color: Default black outline, transparent fill.
Text: Centered below the icon.
Properties:
name: String (The display name).
alias: String (Internal ID for linking).
stereotype: String (Optional, e.g., <<Service>>).
isAbstract: Boolean (Keyword: abstract).
Connections: Association (--), Generalization (--|>), Dependency (..>).
Entity: Use Case
DSL Keyword: usecase or case
Mandatory Syntax: usecase "<Name>" [as <Alias>]
Validation Rule: Name must be a Verb and WordCount <= 3. (Parser Error if > 3).
Visual Style:
Shape: Ellipse (Oval).
Color: Default light yellow/white fill.
Text: Centered inside the oval.
Compartments: Horizontal line separating Name from Extension Points (if present).
Properties:
name: String.
extensionPoints: List.
isAbstract: Boolean.
Connections: Association, Include, Extend, Generalization.
Entity: Boundary (Subject)
DSL Keyword: boundary or system
Mandatory Syntax: boundary "<Name>" {... }
Visual Style:
Shape: Rectangle enclosing nested elements.
Label: Top-Left Corner (Strict UML 2.5 compliance).
Z-Index: Must be rendered behind Use Cases.
Properties:
name: String (Must be a Noun).
Connections: None (Acts as a container).
Entity: Package
DSL Keyword: package
Mandatory Syntax: package "<Name>" {... }
Visual Style:
Shape: Tabbed Folder.
Label: In the tab.
Properties: name: String.
4.3 Relationship Specifications
The DSL defines four distinct arrow types. The parsing logic must strictly enforce the direction and type compatibility rules defined in the Course Guide.
Connection: Association
DSL Symbol: --
Line Style: Solid line.
Arrow Head: None (Strict bidirectional rule).
Valid Source/Target: Actor $\leftrightarrow$ Use Case.
Syntax: <ActorID> -- <UseCaseID>
Attributes:
multiplicity_source: String (e.g., "1").
multiplicity_target: String (e.g., "0..*").
Rendering: Multiplicity labels placed at the ends of the line.
Connection: Generalization
DSL Symbol: --|>
Line Style: Solid line.
Arrow Head: Closed Hollow Triangle (Standard UML Inheritance).
Valid Source/Target: Actor $\to$ Actor, Use Case $\to$ Use Case.
Syntax: <ChildID> --|> <ParentID>
Validation Logic: The compiler accumulates these links. Post-parse, it runs a graph traversal. If a connected component has $<3$ nodes, emit WARN: Generalization Rule of 3 Violated.
Connection: Include
DSL Symbol: ..> <<include>>
Line Style: Dashed line.
Arrow Head: Open Arrow (>).
Valid Source/Target: Use Case $\to$ Use Case.
Syntax: <BaseID>..> <IncludedID> : <<include>>
Visual Layout: The stereotype <<include>> must be rendered in guillemets at the center of the line.
Connection: Extend
DSL Symbol: <.. <<extend>>
Line Style: Dashed line.
Arrow Head: Open Arrow (>).
Valid Source/Target: Extension $\to$ Base.
Syntax: <ExtensionID>..> <BaseID> : <<extend>>
Constraint: The arrow points towards the Base (the item being extended).
Visual Layout: Stereotype <<extend>> at center. Optional Note attached for "Condition".

5. Edge Cases & Layout Handling
To ensure the software tool is robust, the DSL specification must explicitly handle edge cases where the simplified rules of the Course Guide conflict with diagramming reality.
5.1 Nesting and Scope Resolution
Constraint: Actors must not be inside the System Boundary (Subject).
Edge Case: User writes:
boundary "ATM" {
   actor User
   usecase "Login"
}


Handling: The DSL compiler must detect actor definitions inside a boundary block.
Behavior: It should logically register the actor but visually render it outside the rectangle box to maintain UML semantic correctness. The actor will be placed to the left of the boundary by default.
Package Nesting: Use Cases can be nested in Packages inside Boundaries. The namespace path (e.g., System::AdminPackage::UseCase1) must be preserved to avoid name collisions.
5.2 Label Collision and Placement
Issue: <<include>> and <<extend>> labels often overlap connection lines in dense diagrams.
Solution: The DSL renderer must implement a "label guard" zone.
If using an iterative layout engine (like Force-directed), labels act as repulsive nodes.
If using a hierarchical engine (like Dagre), labels are integral parts of the edge path.
Multiplicity Positioning: Multiplicity strings (1..*) must be anchored to the end-points of the Association line, offset by 5px perpendicular to the line vector.
5.3 Extension Point Rendering
Issue: The user defines an extend relationship but forgets to define the ExtensionPoint in the base case.
Handling:
Strict Mode: Compiler Error ("Extension defined without target point").
Loose Mode: The diagram renders the dashed arrow but omits the extension point reference in the specific note.
Visuals: If extension points are defined, the Use Case oval must be split horizontally. The top half contains the Name; the bottom half lists the points left-aligned.
5.4 "Rule of 3" Validation Logic
Algorithm:
Build graph $G_{gen}$ where edges are --|>.
Find all connected components $C_i$ in $G_{gen}$.
For each $C_i$, if $|Nodes(C_i)| < 3$, add to error report.
User Feedback: The error message should suggest: "Pedagogical Constraint: You have an inheritance chain with only 2 elements. Please add a third element or use a different relationship."

6. Sample DSL Code
To illustrate the specification, here is an example of valid code in the proposed UseCaseDSL:
Fragment de cod
// Define System Boundary (Subject)
boundary "Library Management System" {

    // Define Use Cases (Must be Verbs, < 4 words)
    usecase "Borrow Book" as UC1 {
        point: check_availability
    }
    usecase "Return Book" as UC2
    usecase "Reserve Book" as UC3

    // Abstract Parent Use Case (for Rule of 3)
    abstract usecase "Manage Transaction" as UCParent

    // Inheritance (Rule of 3 satisfied: UC1, UC2, UCParent)
    UC1 --|> UCParent
    UC2 --|> UCParent

    // Mandatory Functionality
    usecase "Authenticate User" as UCAuth
    UC1..> UCAuth : <<include>>

    // Optional Functionality
    usecase "Calculate Fine" as UCFine
    UCFine..> UC2 : <<extend>>
}

// Define Actors (Must be Nouns)
actor "Student" as Act1
actor "Librarian" as Act2
abstract actor "Person" as ActParent

// Inheritance (Rule of 3 satisfied)
Act1 --|> ActParent
Act2 --|> ActParent

// Associations (Bidirectional, Multiplicity)
Act1 "1" -- "0..5" UC1
Act2 -- UC3


7. Conclusions
This Language Specification provides a complete blueprint for the UseCaseDSL. By enforcing the specific constraints of the Course Guide—such as the "Noun/Verb" naming rules and the "Rule of 3" for generalization—the DSL ensures that students produce diagrams that meet their grading criteria. Simultaneously, by integrating the UML 2.5.1 metamodel for attributes like visibility, abstract classifiers, and extension points, the tool ensures technical correctness and future extensibility. The result is a rigorous, educational-grade modeling language that does not compromise on professional standards.

Sources
: AMS_Partea_I_RO.doc (Course Guide Context).
: Regulile sintaxei Diagrama Cazurilor de utilizare.pdf (Primary Constraints Source).
: Regulile sintaxei Analysis (Naming Conventions).
/ / : OMG UML 2.5.1 Specification (Normative Standard).
/ : UML Classifiers & Metamodel (Attributes).
/ : UML Extend & Extension Points (Relationship Detail).
/ : UML Subject/Boundary (Visual Standards).
/ : PlantUML Documentation (Syntax Benchmarks).
/ : Mermaid Documentation (Layout Benchmarks).