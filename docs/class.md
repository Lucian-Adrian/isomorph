Language Specification and Architectural Definition for the "ClassModel" Domain Specific Language
1. Executive Summary and Architectural Scope
The domain of software engineering has long grappled with the gap between conceptual design and implementation. The Unified Modeling Language (UML), currently in version 2.5.1, stands as the de facto standard for visual modeling, providing a rigorous semantic framework for describing software systems. However, the complexity of the full UML specification often necessitates simplified subsets for educational and agile contexts. This report defines the architectural specification for "ClassModel," a text-to-diagram Domain Specific Language (DSL) specifically engineered to bridge a constrained educational subset of UML (the "Teacher's Core") with the robust industrial standards of OMG UML 2.5.1.
The primary challenge addressed in this specification is the reconciliation of a restrictive, simplified rule set provided in the "Course Guide" with the implementation realities required for a functioning software tool. A tool that strictly adheres only to the simplified rules would lack the expressive power to model actual code structures (such as method signatures, visibility modifiers, and static members). Conversely, a tool that ignores the educational constraints would fail to reinforce the specific pedagogical goals—such as the mandatory naming conventions and structural limitations on generalization—mandated by the primary source.
Therefore, this language specification adopts a "Core + Extension" architecture. The Core module strictly enforces the "Teacher's Core" constraints—such as the "noun-only" rule for class names and the "I-prefix" rule for interfaces—as hard validation errors. The Extension module fills the semantic gaps using the OMG UML 2.5.1 specification and established patterns from industry tools like PlantUML and Mermaid , enabling the representation of attributes, operations, and complex relationships necessary for code generation and detailed design documentation.
This report serves as the definitive reference for language engineers, compiler front-end developers, and rendering architects tasked with implementing the ClassModel DSL. It provides a granular analysis of lexical rules, syntactic structures, semantic validation logic, and visual rendering requirements, ensuring the final tool is both educationally compliant and professionally robust.

2. The "Teacher's Core": Mandatory Constraints and Semantics
The foundation of the ClassModel DSL is the set of constraints extracted from the "Course Guide". In the context of this language specification, these rules are treated as inviolable invariants. The compiler's semantic analysis phase must prioritize these rules over standard UML permissiveness. While standard UML allows significant flexibility in naming and topology, the ClassModel DSL imposes a stricter governance model to satisfy the specific educational requirements identified in the primary source.
2.1. Mandatory Elements and Entities
The primary source explicitly identifies two fundamental structural entities: the Class and the Interface. The definition of these entities goes beyond standard UML by attaching specific semantic and syntactic constraints.
2.1.1. The Class (Clasa)
The "Course Guide" defines a Class as a representation of a "totality of objects". This definition aligns with the UML concept of a Classifier but imposes a specific semantic scope that includes abstract persons, general systems, or specific subsystems.
Mandatory Syntax (Naming Convention): The specification requires a strict naming convention. The name of a class must always be a noun (substantiv).
Implementation Implication: The DSL parser should ideally integrate a lightweight Natural Language Processing (NLP) tagger or a morphological dictionary to validate that the identifier provided for a class is a noun. At a minimum, the compiler must issue a warning if the name appears to be a verb (e.g., "Calculate" vs. "Calculator").
Visual Representation: While standard UML represents a class as a rectangle with three compartments (Name, Attributes, Operations) , the primary source implicitly accepts this but emphasizes the entity's role in the system. The DSL must render a class as a solid-bordered rectangle.
2.1.2. The Interface (Interfața)
The Interface is defined as the "initial part of any system" , representing a contract or a boundary definition.
Mandatory Syntax (Naming Convention): The "Course Guide" imposes a hard lexical rule: the name of an interface must always begin with the letter 'I' (e.g., IBancomat, ISistemOperare).
Implementation Implication: The parser must enforce a regular expression check ^I[A-Z][a-zA-Z0-9_]* on all interface identifiers. Violations must be flagged as syntax errors, preventing compilation. This is a deviation from standard UML, where the I prefix is a convention (often from COM or.NET) but not a specification requirement.
Visual Representation: The primary source explicitly illustrates the interface using the "lollipop" notation—a circle labeled with the interface name.
Implementation Implication: While UML 2.5.1 allows both the lollipop notation and the stereotyped rectangle <<interface>> , the ClassModel DSL must default to the lollipop notation to strictly align with the "Teacher's Core." The rectangular notation should only be triggered if the user explicitly defines internal operations that cannot be visually represented in a circle.
2.2. Mandatory Relationships and Topological Constraints
The "Course Guide" defines six specific relationship types. Crucially, it imposes topological constraints—rules about how many classes can be connected or what types of entities can be connected—that are stricter than the general UML specification.
2.2.1. Association (Asocierea)
Logic: Defined as a connection that "always connects 2 or more classes".
DSL Semantics: This implies support for binary and n-ary associations. However, given the text-based nature of the DSL, n-ary associations are complex to represent (often requiring a diamond node). The DSL will primarily support binary associations, treating n-ary associations as a decomposition into binary associations or using a specific connector syntax.
Multiplicity Rule: Multiplicity is mandatory for associations unless it is 1:1.
2.2.2. Dependency (Dependenţa)
Logic: Defined as showing the "correspondence" between two or more classes. In UML terms, this signifies that a change in the supplier element requires a change in the client element.
Constraint: The guide implies a simpler usage than the broad UML dependency. It is strictly a "uses" relationship.
Multiplicity Rule: The guide notes that multiplicity is written only for Association, Composition, and Aggregation. Therefore, the DSL parser must forbid multiplicity labels on Dependency links. If a user attempts to write ClassA..> "1..*" ClassB, the compiler must throw a validation error: "Multiplicity is not permitted on Dependency relationships per the Course Guide."
2.2.3. Generalization (Generalizarea)
Logic: Represents inheritance or an "is-a" relationship.
Topological Constraint: The document states this relationship "can be utilized between at least 3 Classes".
Implementation Implication: This is a highly specific and unusual constraint. Standard UML allows binary generalization (one child, one parent). The "Teacher's Core" requires a hierarchy of at least three participants (e.g., Parent <- Child1, Parent <- Child2, or Grandparent <- Parent <- Child). The DSL's semantic validator must construct the inheritance graph and check the node count of connected components. If a generalization chain has fewer than 3 nodes, a warning must be issued: "Course Constraint: Generalization hierarchies should involve at least 3 classes."
2.2.4. Composition (Compoziția)
Logic: A strong "whole-part" relationship where the part cannot exist without the whole. This implies lifecycle coupling.
Visual Style: A solid line with a filled diamond at the container end.
Multiplicity Rule: Mandatory support.
2.2.5. Aggregation (Agregarea)
Logic: A weak "whole-part" relationship where the part can exist independently of the whole.
Visual Style: A solid line with a hollow diamond at the container end.
Multiplicity Rule: Mandatory support.
2.2.6. Realization (Realizarea)
Logic: Always used to connect a Class with an Interface.
Constraint: The DSL must enforce type checking on the relationship endpoints.
Source: Must be a class.
Target: Must be an interface.
Error Condition: Connecting two classes or two interfaces with a Realization link is invalid under this core rule set.
2.3. The "Implicit 1:1" Multiplicity Rule
A critical syntactic simplification in the "Teacher's Core" is the handling of default multiplicity.
Rule: "When the multiplicity is 1 to 1 for all relationships, it is not written because it is implicitly understood".
Implementation Requirement: The DSL renderer must implement a specific filter. If the internal model stores a multiplicity of 1 or 1..1, the rendering engine must suppress the text label on the diagram. Users should not be forced to manually hide it; the system must automate this "clean" look. Conversely, any other multiplicity (0..1, *, 1..*) must be explicitly rendered.

3. The "UML Spec" Expansion (The Missing Pieces)
While the "Teacher's Core" provides the governing constraints, it leaves significant gaps in the technical specification required to build a usable modeling tool. It mentions "Attributes" and "Operations" in the Table of Contents but fails to define their syntax. To ensure the ClassModel DSL is capable of generating professional-grade diagrams and potentially scaffolding code, we must integrate the rigorous definitions from the OMG UML 2.5.1 Specification.
3.1. Attribute and Operation Semantics
The DSL must support the full signature of class members to be useful for software architects. The simplistic view of "just names" is insufficient for modern modeling.
3.1.1. Visibility Modifiers
Access control is fundamental to object-oriented design. The DSL must support the standard UML visibility symbols, which map directly to programming language keywords (public, private, protected).
Symbol
UML Visibility
Description
Implementation Requirement
+
Public
Visible to all elements accessing the namespace.
Render as + or icon (green circle).
-
Private
Visible only within the defining namespace.
Render as - or icon (red square).
#
Protected
Visible to elements with a generalization relationship.
Render as # or icon (yellow diamond).
~
Package
Visible to elements within the same package.
Render as ~ or icon (blue triangle).

Gap Filler: The DSL grammar must accept these symbols as optional prefixes to any attribute or operation name (e.g., +balance, -password).
3.1.2. Scope and Instantiation (Static vs. Instance)
The concept of "static" members (class-scope vs. instance-scope) is a standard UML feature not detailed in the primary source but essential for implementation.
UML Specification: Static members are visually distinguished by underlining the text.
DSL Expansion: The DSL will introduce a {static} modifier or a specific syntax (like a double underscore prefix __name__ or a keyword static) to trigger this rendering style. The generated diagram must render the text with the text-decoration: underline style property.
3.1.3. Abstract Classes and Members
Abstract classes are crucial for the "Generalization" relationship mandated by the Teacher's Core.
UML Specification: The name of an abstract class or an abstract operation is shown in italics.
DSL Expansion: The DSL must support an abstract keyword in the class definition (e.g., abstract class Shape). This keyword triggers the italic font style for the class name header. Similarly, abstract methods within a class must be rendered in italics.
3.2. Detailed Relationship Visuals
The primary source lists relationships but does not define their visual contract. To prevent ambiguity, the DSL must adhere to the strict line styles defined in UML 2.5.1.
Relationship
DSL Keyword
Line Style
Arrowhead
Tail Notation
Association
--
Solid
Open (>) or None
None
Dependency
..>
Dashed
Open (>)
None
Generalization
`--
>`
Solid
Hollow Triangle (`
Realization
`..
>`
Dashed
Hollow Triangle (`
Aggregation
o--
Solid
None
Hollow Diamond (<>)
Composition
*--
Solid
None
Filled Diamond (<*>)

Gap Filler: The distinction between the "Hollow Triangle" (Generalization) and the "Open Arrow" (Association) is critical. The DSL renderer must use distinct SVG markers for these to avoid the common confusion between "inherits from" and "associates with."
3.3. Advanced UML Concepts (Generics and Stereotypes)
Modern software development relies heavily on generic types (templates) and metadata (stereotypes).
Templates/Generics: UML 2.5.1 defines a notation for parameterized classes (templates) using a dashed box in the upper-right corner.
DSL Syntax: class List<T> or class List~T~. The DSL should support generic type parameters in class definitions to accurately model collections, a common requirement in student projects (e.g., List<Employee>).
Stereotypes: UML uses guillemets (<<name>>) to extend semantics.
DSL Syntax: class Controller <<Service>>. This allows users to label classes with architectural roles (e.g., <<Entity>>, <<Repository>>) even if the specific visual shape doesn't change.

4. Comparative Analysis of Syntax Paradigms
Before defining the formal ClassModel DSL, it is prudent to analyze existing solutions—specifically PlantUML and Mermaid—to determine the optimal syntactic approach.
4.1. PlantUML Paradigm
PlantUML uses a declarative syntax that closely mimics programming languages but allows for flexible, out-of-order definitions.
Pros: Extremely mature, supports detailed styling (skinparam), handles complex nesting well.
Cons: Can become verbose; the syntax for styling is idiosyncratic.
Relevance: Its handling of packages and namespaces is the gold standard for text-to-diagram tools.
4.2. Mermaid.js Paradigm
Mermaid uses a more graph-oriented syntax (A --> B) and is natively integrated into many markdown editors (GitHub, GitLab).
Pros: Web-native, very simple syntax for relationships.
Cons: Historically weaker support for complex class features like nested generic types or detailed member visibility compared to PlantUML.
Relevance: Its concise relationship syntax (ClassA <|-- ClassB) is very intuitive for students.
4.3. Recommendation for ClassModel DSL
The ClassModel DSL will adopt a hybrid approach:
Entity Definition: Use the bracket-based block syntax (class Name {... }) similar to C#/Java/PlantUML. This reinforces code structure mental models for students.
Relationship Definition: Use the arrow-based syntax (A --> B) similar to Mermaid/PlantUML, as it visually represents the connection.
Constraint Enforcement: Unlike both tools, ClassModel will inject the "Teacher's Core" validation logic (e.g., checking for "I" prefixes) directly into the parser.

5. The DSL Definition (The Code Structure)
This section provides the formal specification of the ClassModel DSL. It defines the keywords, grammar, and rendering rules required to implement the language.
5.1. Entity Definitions
The language supports two primary definition blocks: class and interface.
Entity: Class
DSL Keyword: class
Grammar: class Identifier? { Body }
Identifier Validation: The Identifier must pass a noun-check validation. If a verb is detected (e.g., "Run"), the compiler issues a warning: "Style Warning: Class names should be nouns.".
Visual Style:
Shape: Rectangular box divided into three horizontal compartments.
Compartment 1: Centered Class Name (Bold). If abstract, text is Italic.
Compartment 2: Attributes (Left-aligned).
Compartment 3: Operations (Left-aligned).
Color: Default fill white/transparent, black border (1px).
Properties:
name: String (Mandatory).
isAbstract: Boolean (Triggered by abstract class keyword).
stereotype: String (Optional, e.g., <<Entity>>).
Entity: Interface
DSL Keyword: interface
Grammar: interface Identifier { Body }
Identifier Validation: Identifier MUST match regex ^I[A-Z]. Failure triggers a Critical Error: "Naming Violation: Interface names must start with 'I' per course rules.".
Visual Style:
Default Mode: "Lollipop" notation (Circle with name below/beside). This is the mandatory view per the Course Guide.
Expanded Mode: If the Body contains operations, the renderer automatically switches to a rectangular class notation with the <<interface>> stereotype to display the methods, as they cannot be rendered inside a circle.
Connections: Can be the target of a Realization relationship.
5.2. Member Syntax (Attributes & Operations)
Inside the entity body, members are defined using a unified syntax string that maps to UML visibility and type signatures.
Syntax Format:
[Visibility][Name] :[Multiplicity?] {Properties?}
Visibility Maps:
+ $\rightarrow$ Public (Render + symbol)
- $\rightarrow$ Private (Render - symbol)
# $\rightarrow$ Protected (Render # symbol)
~ $\rightarrow$ Package (Render ~ symbol)
Static Members:
Syntax: {static} prefix or static keyword.
Visual: The entire member string is underlined.
Abstract Operations:
Syntax: {abstract} prefix or abstract keyword.
Visual: The member string is italicized.
Standard Properties:
The DSL supports standard UML property modifiers in braces at the end of the string: {readOnly}, {ordered}, {unique}, {id}.
Example DSL Code:
Fragment de cod
class Angajat {
  - nume : String
  # dataAngajarii : Date
  {static} + numarAngajati : int {readOnly}
  + calculeazaSalariu() : float
}

5.3. Relationship Syntax and Semantics
Relationships are defined outside of class blocks to keep the definition clean. The DSL uses ASCII-art arrows to define type and direction.
Connection: Association
DSL Symbol: -- (Bi-directional) or --> (Uni-directional)
Line Style: Solid.
Arrow Head: Open arrow (>) for directional; none for bi-directional.
Validation: Connects 2 or more classes.
Multiplicity: Supported. ClassA "1" -- "0..*" ClassB.
Connection: Dependency
DSL Symbol: ..>
Line Style: Dashed.
Arrow Head: Open arrow (>).
Logic: "Client depends on Supplier".
Constraint: No multiplicity allowed. The parser must reject multiplicity labels on this link type based on the strict reading of.
Connection: Generalization (Inheritance)
DSL Symbol: --|>
Line Style: Solid.
Arrow Head: Hollow Triangle (Closed, empty fill).
Logic: Child inherits from Parent.
Validation: The 3-Class Rule. The compiler builds an inheritance graph. For every connected component of Generalization edges, it counts the nodes.
if node_count < 3: Emit Warning: "Pedagogical Warning: Generalization hierarchies should involve at least 3 classes to demonstrate polymorphism.".
Connection: Realization
DSL Symbol: ..|>
Line Style: Dashed.
Arrow Head: Hollow Triangle.
Logic: Class implements Interface.
Validation: Source must be class. Target must be interface.
Connection: Composition
DSL Symbol: *--
Line Style: Solid.
Arrow Head: Filled Diamond (at the "Whole" end).
Logic: Whole owns Part.
Semantics: Deleting the Whole implicitly deletes the Part.
Connection: Aggregation
DSL Symbol: o--
Line Style: Solid.
Arrow Head: Hollow Diamond (at the "Whole" end).
Logic: Whole has Part (shared).

6. Edge Cases & Layout Management
A robust DSL must handle the complexities of real-world diagrams, including nesting, layout hints, and labeling collisions.
6.1. Handling Nesting and Packages
While not explicitly detailed in the primary source, namespace management is a standard UML requirement. The DSL supports nesting via braces.
Syntax:
Fragment de cod
package BankingSystem {
    class Cont
    interface IBancomat
}


Visual: A large "folder" styled rectangle containing the nested elements.
Naming Scope: Elements inside are scoped (e.g., BankingSystem::Cont). If a relationship crosses package boundaries, the line connects the internal element to the external element, crossing the package border.
6.2. Layout and Labeling Strategies
6.2.1. Labels on Lines
UML allows labeling relationships (e.g., "employs", "owns").
Syntax: ClassA -- ClassB : LabelText
Rendering: The renderer places LabelText at the midpoint of the link. It effectively adds a background color (white) to the text label to prevent visual clutter if it crosses other lines.
6.2.2. Multiplicity Placement
Multiplicity (1, 0..*) must be placed at the ends of the lines.
Syntax: Source "SourceMult" -- "TargetMult" Target
Rendering Rule (Implicit 1:1): The renderer checks the string value of the multiplicity.
If value == "1" OR value == "1..1", do not render.
If value!= "1", render text adjacent to the connector. This logic strictly enforces the "implicit 1:1" rule from the Teacher's Core while allowing the underlying model to remain accurate.
6.2.3. Directional Hints
To give users control over the layout (avoiding "spaghetti" diagrams), the DSL supports hidden directional hints, similar to PlantUML.
Syntax: ClassA -up-> ClassB, ClassA -right-> ClassB.
Implementation: These keywords act as constraints for the graph layout engine (e.g., Graphviz Dot or Elk). -up-> forces the rank of ClassB to be higher than ClassA.

7. Conclusion and Implementation Roadmap
This specification defines "ClassModel," a Domain Specific Language that successfully bridges the gap between educational constraint and industrial utility.
Educational Compliance: It rigorously enforces the "Teacher's Core" rules—specifically the noun naming convention for classes, the "I" prefix for interfaces, the "3-class minimum" for generalization, and the strict rules on multiplicity visibility.
Industrial Robustness: By integrating UML 2.5.1 standards for visibility, static members, and precise relationship markers, the language ensures that students learn standard notations that are transferable to professional tools like Enterprise Architect or Visual Paradigm.
Technical Feasibility: The defined grammar is parseable by standard LL(k) parsers (like ANTLR), and the visual definitions map cleanly to SVG or Canvas rendering primitives.
The resulting tool will serve as a "strict compiler" for students—guiding them away from common errors (like naming interfaces Bancomat instead of IBancomat)—while producing diagrams that are aesthetically compliant with the highest standards of software architecture documentation.

Sources
: Regulile sintaxei Diagrama Claselor.pdf (Primary Source - Core Rules).
: AMS_Partea_I_RO.doc (Primary Source - Table of Contents).
: OMG Unified Modeling Language (UML) Specification Version 2.5.1 (Secondary Source - Standard Semantics).
: PlantUML Language Reference (Complementary Source - Syntax Patterns).
: Mermaid.js Documentation (Complementary Source - Web-native Syntax).
: Wikipedia - Class Diagram (Standard Notation References).
: UML-Diagrams.org (Visibility and Package Semantics).
: Visual Paradigm & Rice University UML Guides (Line Styles and Relationships).
: UML 2.5.1 Association and Association Class specifications.
