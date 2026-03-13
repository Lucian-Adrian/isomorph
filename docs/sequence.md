Language Specification for the Sequence Diagram Domain Specific Language (DSL): Bridging Pedagogical Constraints with Industrial Standards
1. Architectural Overview and Design Philosophy
The development of a Domain Specific Language (DSL) for Sequence Diagrams represents a significant intersection of software linguistics, model-driven engineering (MDE), and visual communication theory. The primary objective of this specification is to architect a textual language that serves two distinct masters: the rigorous, simplified constraints of a specific educational curriculum (The "Teacher's Core") and the expansive, mathematically precise metamodel of the Object Management Group's (OMG) Unified Modeling Language (UML) version 2.5.1 specification.
This report serves as the authoritative definition for the DSL compiler and rendering engine. It moves beyond a simple feature list to analyze the semantic implications of each language construct, the necessary validation logic required to enforce specific course rules, and the "gap-filling" measures required to transform a classroom subset into a viable, industrial-grade modeling tool. The design philosophy adopted here is one of "strict core, permissive expansion." The DSL must enforce the specific syntactic sugar and semantic limitations requested by the instructor—such as the mandatory use of nouns for actors or the asterisk symbol for destruction—while simultaneously supporting the underlying UML 2.5.1 metamodel elements like ExecutionSpecification, StateInvariant, and complex CombinedFragments that are implied but not explicitly detailed in the course guide.
The analysis indicates that a text-to-diagram tool in this context acts as a translation layer between a high-level human-readable syntax and a low-level graphical rendering graph. By examining existing tools such as PlantUML, Mermaid, and standard implementations in Enterprise Architect, this specification derives a syntax that is both intuitive for students and structurally sound for software architects. The resulting language definition addresses not just the "what" (shapes and lines) but the "how" (lifecycle management, nesting logic, and scope validation).

2. The "Teacher's Core" Specification
The foundation of this DSL is the "Course Guide" , which functions as the requirements specification for the primary use case: educational assessment. This document defines a strict subset of UML with specific deviations from the standard that must be treated as "hard constraints" in the DSL's semantic analyzer. The analysis of the attached file reveals a focus on the Robustness Diagram concepts (Entity-Control-Boundary) applied within a Sequence Diagram context, alongside specific lifecycle management rules.
2.1 Mandatory Elements
The following elements are explicitly required by the course material. The DSL must provide first-class keywords and rendering logic for these specific shapes. Unlike standard UML tools that might treat all participants generically, this DSL must structurally differentiate between an "Actor," an "Object," and the specific "New Object" creation workflow.
Element
Description & Context
Visual Requirement
Actor
Represents an external initiator of actions. The guide explicitly notes that diagrams can contain one or more actors. This implies the DSL must support multi-actor initialization.
Stick figure (옷).
Object
An instance (exemplar) of a class representing system parts. The guide lists examples like "Interface," "System," "BD" (Database), and "Start Page."
Rectangular box with the name underlined to denote an instance (<u>Object1</u>).
New Object
An object created dynamically during the system's operation (e.g., Catalog, Form, Ticket). This creates a critical layout constraint: the lifeline cannot start at $Y=0$.
The head of the lifeline is placed lower on the vertical axis, specifically at the point of creation event.
Delete Object
Represents the destruction of an object. The guide deviates from the standard UML X by mandating an asterisk.
Asterisk (*) symbol at the end of the lifeline.
Message
Information transmitted between entities. The guide implies a broad definition, covering both method calls and data returns.
Directed arrow with a label.
Self-Call
Represents an object performing checks or processing on itself (internal methods).
An arrow looping back to the same lifeline.
Fragment (alt)
The only interaction operator explicitly demanded is alt, representing alternative execution paths (Success vs. Failure).
A rectangular frame enclosing the interaction with an alt label in the top corner.

2.2 Mandatory Syntax and Semantic Validation
The "Course Guide" imposes semantic constraints that exceed simple graphical representation. These rules require the DSL compiler to implement a symbol table and a semantic validator (linter) to ensure compliance before rendering. These are not merely suggestions; they are grading criteria translated into code constraints.
2.2.1 Naming Conventions (Part-of-Speech Tagging)
The guide mandates a strict linguistic convention: "Denumirea actorului întotdeauna va fi un substantiv" (The name of the actor must always be a noun) and similarly for objects.
Implication for DSL: The parser cannot simply accept any string. Ideally, the DSL tool should integrate a basic Natural Language Processing (NLP) library or a dictionary lookup to warn users if they use verbs (e.g., "Login", "Process") as identifiers for Actors or Objects. The validator must enforce that identifiers are nouns (e.g., "User", "Administrator", "Database").
Syntax Rule: Identifiers for actor and object definitions are restricted to alphanumeric strings that represent nouns.
2.2.2 Conditional Logic in Fragments
The label for an alt fragment must be explicitly "gândită sub forma unei condiții" (thought of in the form of a condition).
Implication for DSL: The syntax for defining an alternative block must explicitly separate the keyword alt from the condition string. The DSL should force the user to provide this condition, rejecting alt blocks that are empty or unlabeled.
Syntax Rule: alt... else... end.
2.2.3 Object Lifecycle and Ownership
A critical and complex rule found in the guide states: "Ștergerea va fi efectuată de către obiectul care l-a creat" (Deletion must be performed by the object that created it).
Implication for DSL: This requires the DSL to track the "Creator" of every "New Object."
When a create message is parsed (e.g., A -> B: create), the compiler must record A as the parent/owner of B.
When a destroy message is parsed (e.g., C -> B: destroy), the compiler must verify that C == A.
If C!= A, the compiler must emit a semantic error: "Violation of Lifecycle Rule: Object 'B' can only be destroyed by its creator 'A', but was destroyed by 'C'."
2.2.4 Numbering and Text
Messages must be numbered (e.g., 1. Message()) and can contain a variable number of words.
Implication for DSL: To reduce user error, the DSL should include an autonumber feature similar to PlantUML or Mermaid. However, the text string following the number allows for free-form text, meaning the tokenizer must handle spaces and special characters within message labels.

3. The "UML Spec" Expansion (The Missing Pieces)
The "Teacher's Core" provides a skeletal framework sufficient for a specific homework assignment but insufficient for a robust, general-purpose sequence diagram tool. To build a functioning software tool, we must fill the implementation gaps using the OMG UML 2.5.1 Specification. The Course Guide implies the existence of complex behaviors (like message passing) but fails to define the visual variations (synchronous vs. asynchronous) or the metadata attributes (visibility, signatures) necessary for code generation or detailed analysis.
3.1 Lifeline Attributes and Attributes
In the Course Guide, "Objects" are treated as simple named entities. However, UML 2.5.1 defines a Lifeline as a representation of an individual participant in an interaction. To support standard code engineering, the DSL must support the following attributes not mentioned in the guide but essential for implementation.
3.1.1 Anonymity vs. Named Instances
The guide assumes objects are named (e.g., "Object1"). Standard UML allows for anonymous instances.
Expansion: The DSL must allow the definition of lifelines that have a class but no instance name (e.g., :Order) and lifelines that have an instance name but no class (e.g., currentOrder).
Standard Syntax Support: name : Class or : Class or name.
3.1.2 Selectors
UML 2.5.1 allows a lifeline to represent a specific element from a collection using a selector. If an object represents a specific user in a list of users, the notation is User[i].
Expansion: The DSL must support subscript or selector syntax to denote multiplicity, which is critical for loops and array processing.
3.1.3 Decomposition
A lifeline in UML can refer to another interaction diagram via a ref mechanism (InteractionUse).
Expansion: To support complex systems, the DSL should allow a lifeline to be "decomposed" into a separate sub-diagram, although this may be an advanced feature.
3.2 Message Sorts and Line Styles (The Visual Grammar)
The Course Guide lists "Relația sincronă" (Synchronous), "Relația asincronă" (Asynchronous), and "Relația return" (Return). It fails to explicitly define the line styles (solid vs. dashed) and arrowhead styles (open vs. filled), which are strictly defined in UML 2.5.1. The DSL must map the teacher's terms to these standard visual attributes.
Teacher's Term
UML 2.5.1 Concept
MessageSort
Visual Specification
Relația sincronă
Synchronous Call
synchCall
Solid Line with a Filled Arrowhead. The sender suspends execution until a return is received.
Relația asincronă
Asynchronous Call
asynchCall
Solid Line with an Open Arrowhead. The sender proceeds immediately; no blocking.
Relația return
Reply Message
reply
Dashed Line with an Open Arrowhead. Represents the return of control/data from a synchronous call.
New Object
Create Message
createMessage
Dashed Line with an Open Arrowhead pointing to the head of the created lifeline.
Delete Object
Delete Message
deleteMessage
Solid or Dashed line terminating on the destruction marker.

Gap Filler: The DSL must strictly enforce these line styles. A common error in students (and some tools) is using a solid line for return messages or an open arrow for synchronous calls. The DSL generation engine must prevent this ambiguity.
3.3 Visibility and Operation Signatures
The Course Guide mentions "Message()" but does not specify how to represent private vs. public operations, which is standard in UML class and sequence diagrams.
UML Spec: Operations have visibility modifiers: + (public), - (private), # (protected), ~ (package).
Expansion: The DSL should support parsing these modifiers at the beginning of a message label.
Input: User -> System: +login(password)
Output: Renders the + symbol or uses specific color coding to denote visibility.
Static vs. Instance: While not explicitly requested, standard UML supports static method calls (underlined message text). The DSL should include a syntax marker (e.g., static message()) to support this standard attribute.
3.4 Missing Relationships and Interaction Fragments
The Course Guide only mentions alt (Alternatives). UML 2.5.1 defines a rich set of InteractionOperators that are necessary for any non-trivial logic. To make the tool useful, we must include:
opt (Option): Represents a choice with only a "then" branch (effectively if without else). This is distinct from alt.
loop (Iteration): The guide mentions "Diagrama Secvențelor" often involves repetition. UML defines the loop operator, which allows specifying min/max iteration counts (e.g., loop(1, 10)).
break: Represents a scenario where the enclosing interaction is abandoned (e.g., throwing an exception).
par (Parallel): Necessary for modern multi-threaded applications. The guide mentions "Control" objects, which often spawn parallel threads.
critical: Defines a critical region that cannot be interleaved by other threads.
The DSL must reserve keywords for all these operators, even if the student only strictly needs alt.
3.5 State Invariants and Constraints
UML 2.5.1 defines State Invariants—conditions that must be true for a lifeline at a specific point in time.
Visual: A rounded rectangle or curly braces {} on the lifeline.
Context: The "Teacher's Core" includes "Self-calls" for checks. State invariants are the formal UML method for depicting "The object is now in 'Logged In' state."
Expansion: The DSL should support a syntax like state Object1: "Waiting" to draw these invariants.

4. The DSL Definition (The Code Structure)
This section formally defines the syntax of the language. It uses a structure inspired by PlantUML and Mermaid but adapted to strictly enforce the "Teacher's Core" while allowing "UML Spec" expansion.
4.1 Global Configuration
Commands that establish the environment for the diagram.
autonumber: A boolean switch or configuration line.
Requirement: states messages must be numbered.
Behavior: When enabled, the compiler automatically prefixes messages with 1., 2., etc.
Syntax: autonumber [start: int][step: int]
strict_mode: A flag to enforce "Teacher's Core" rules.
Behavior: When true, enables the NLP noun-checker for actors and the creator-destroyer lifecycle validation.
4.2 Entity Definition
Defining the participants in the system.
Entity: Generic Participant
DSL Keyword: participant
Visual Style: A rectangular box. If strict_mode is off, this is the default.
Properties: name (ID), label (Display text), stereotype.
Connections: Can connect to any other entity.
Entity: Actor
DSL Keyword: actor
Visual Style: A stick figure (옷) as required by.
Properties: name.
Mandatory Syntax: The name must be validated as a Noun.
Syntax: actor User or actor "Admin User" as Admin.
Entity: Stereotyped Objects (The BCE Pattern) The Course Guide explicitly references the Boundary-Control-Entity pattern. To simplify usage, the DSL will provide specific keywords that map to UML classes with standard stereotypes.
Boundary
DSL Keyword: boundary
Visual Style: A circle connected to a vertical line (T-shape logic) or a Class with <<Boundary>> and the Robustness icon.
Logic: Represents the Interface.
Control
DSL Keyword: control
Visual Style: A circle with an arrow tip or Class with <<Control>>.
Logic: Represents the System/Logic.
Entity
DSL Keyword: entity
Visual Style: A circle with a horizontal line/bar at the bottom or Class with <<Entity>>.
Logic: Represents the Database/BD.
Syntax Example:
Fragment de cod
actor Client
boundary GUI
control Manager
entity Database

4.3 Lifeline Lifecycle Operations
Handling the dynamic creation and destruction of objects is a core requirement of the "Course Guide."
Operation: Create Object
DSL Keyword: create
Visual Style: The target lifeline's "head" (the box/icon) is not drawn at the top of the diagram. Instead, it appears at the vertical position where the message is received.
UML Spec: Dashed line with open arrowhead (createMessage).
Syntax: Source -->> Target: create() or explicit keyword create Target.
Logic: Registers Source as the creator of Target.
Operation: Delete Object
DSL Keyword: destroy
Visual Style: A large Asterisk (*) at the end of the lifeline.
Note: Standard UML uses a large X. The DSL renderer must implement a "Teacher Mode" toggle to swap the X for an *.
Syntax: Source -> Target: destroy() or explicit keyword destroy Target.
Logic: Terminates the lifeline. Validates that Source == Target.creator.
4.4 Connections (Messages)
Defining the arrows that connect lifelines. The DSL symbols must map to the line styles defined in Section 3.2.
Connection: Synchronous Call
DSL Symbol: ->
Line Style: Solid Line.
Arrow Head: Filled Triangle (Closed).
UML Logic: synchCall. Sender waits.
Connection: Asynchronous Call
DSL Symbol: ->>
Line Style: Solid Line.
Arrow Head: Open Stick.
UML Logic: asynchCall. Sender continues.
Connection: Return / Reply
DSL Symbol: -->> or -->
Line Style: Dashed Line.
Arrow Head: Open Stick.
UML Logic: reply. Return from synchronous call.
Connection: Self-Call
DSL Symbol: -> (where Source == Target).
Visual Style: An arrow leaving the lifeline and re-entering it lower down.
Logic: Internal method invocation.
4.5 Fragments (Control Structures)
Syntax for grouping messages.
Fragment: Alternative
DSL Keyword: alt
Mandatory Syntax: Must include a condition label.
Structure:
Fragment de cod
alt
    User -> System: Valid
else [Condition: Failure]
    User -> System: Invalid
end


Fragment: Loop (UML Extension)
DSL Keyword: loop
Structure: loop [Min, Max][Condition]... end.
Fragment: Option (UML Extension)
DSL Keyword: opt
Structure: opt [Condition]... end.

5. Edge Cases & Layout Considerations
Handling the intersection of "Course Rules" and "Real World Layouts" requires specific engineering solutions in the layout engine.
5.1 Nesting and Scope
Problem: Users will inevitably nest fragments (e.g., a loop inside an alt).
UML Spec: This is valid. The inner fragment's scope is strictly contained within the enclosing fragment's active operand.
DSL Handling: The parser must use a stack-based approach. When alt is encountered, push to stack. When end is encountered, pop. If the stack is empty when else is encountered, throw a syntax error.
Visual Layout: The renderer must draw the outer box with sufficient padding to contain the inner box.
5.2 The "New Object" Vertical Offset
Problem: Standard auto-layout engines (like Graphviz) often try to align all nodes at the top (Rank 0). The "Course Guide" specifically demands that "New Objects" appear lower down.
Solution: The layout engine must treat the diagram as a timeline.
Parse the script linearly.
Assign a Y-coordinate (Time index) to every message.
If an object is defined via create, its StartY is set to the Y-coordinate of the creation message.
All messages involving this object prior to StartY are invalid and should trigger a compiler error.
5.3 Validation of the "Creator-Destroyer" Rule
Problem: The requirement that only the creator can destroy an object is a semantic constraint, not a syntactic one.
Solution: The DSL compiler must maintain a state dictionary for every object instance:
JSON
{
  "ObjectB": {
    "created_by": "ObjectA",
    "is_active": true
  }
}


Logic:
Instruction: A -> B: create(). Update ObjectB.created_by = A.
Instruction: C -> B: destroy(). Check if (ObjectB.created_by == C).
If False: Error "Lifecycle Violation".
If True: Set ObjectB.is_active = false. Draw Asterisk at current Y.
5.4 Handling Labels on Lines
Problem: Text overlap on complex diagrams.
UML Spec: Labels include signature, arguments, and return value.
Layout: The rendering engine must implement a text-avoidance algorithm or simple "background erasure" (drawing a white box behind the text) to ensure legibility where arrows cross lifelines.
Course Constraint: The label must support "Numbering" + "Text". The autonumber generator must prefix the label string provided by the user before calculating the text width for layout.

6. Detailed Analysis of Research Data
6.1 The Pedagogical Constraints (Source:
)
The primary source material, Regulile sintaxei Diagrama Secvențelor.pdf, acts as a constraint mechanism for the DSL. It does not merely suggest styles; it dictates a specific worldview of object interaction.
Nouns vs. Verbs: The insistence on nouns for Actors and Objects aligns with standard Object-Oriented Analysis (OOA) where classes/actors represent entities, and messages represent behaviors (verbs). The DSL must enforce this to help students distinguish between structure and behavior.
The Asterisk (*) Anomaly: Standard UML 2.0+ uses a large X to denote the stop point of a lifeline. The course guide's requirement for an asterisk is a legacy or simplified notation. The DSL must prioritize this "local rule" over the global standard when in default mode, perhaps offering a flag useStandardUMLSymbols = true to switch to X.
Fragments: The guide creates a specific mental model where alt is the primary control structure. By enforcing that the name of the fragment is a condition, the teacher is forcing students to think in terms of boolean logic (Guard Conditions).
6.2 The UML Metamodel Integration (Source:
)
The UML 2.5.1 specification provides the necessary depth to make the DSL viable for more than just simple homework.
Interaction Operators: While the teacher only asks for alt, the UML spec clarifies that alt implies mutually exclusive choices. This distinguishes it from par (concurrent). The DSL must implement the rendering of the dashed horizontal line that separates the operands in an alt block (the else line).
Gate and State: UML defines "Gates" for connecting interactions. While likely out of scope for the course, "State Invariants" are essential for showing the internal status of the "Control" object (e.g., State: Validating). The DSL should allow a syntax like note over Control: State=Valid to approximate this if full state invariant syntax is too complex.
6.3 Comparative Tool Analysis (Source:
)
PlantUML: Uses participant and actor. It supports autonumber. It uses create to handle dynamic creation and destroy for deletion (rendering an X).
Insight: Our DSL should mimic PlantUML's autonumber and box syntax as they are industry standards, but we must override the destroy rendering to use the asterisk.
Mermaid: Uses sequenceDiagram header. It supports alt and opt.
Insight: Mermaid's syntax Alice->>John: Hello is very concise. Our DSL should adopt this arrow-based syntax (->, -->, ->>) as it maps cleanly to the synchronous/asynchronous/return concepts required.

7. Comprehensive DSL Grammar Specification (EBNF Draft)
To finalize the report, we present a formal grammar structure for the Sequence DSL.
EBNF
diagram ::= header declaration* statement*
header ::= "sequenceDiagram" [config_options]
config_options ::= "autonumber" | "strict"

/* Entity Declaration */
declaration ::= entity_type identifier ["as" alias]
entity_type ::= "actor" | "boundary" | "control" | "entity" | "participant"

/* Interaction Statements */
statement ::= message | fragment | lifecycle_op | note

/* Messages */
message ::= source arrow target ":" label
arrow ::= "->" | "-->" | "->>" | "-->>" 
source ::= identifier
target ::= identifier

/* Lifecycle */
lifecycle_op ::= creation | destruction
creation ::= "create" target
destruction ::= "destroy" target

/* Fragments */
fragment ::= "alt" condition statement* ("else" condition statement*)* "end"

| "loop" condition statement* "end"
| "opt" condition statement* "end"

/* Notes */
note ::= "note" ("right of" | "left of" | "over") identifier ":" text

7.1 Table: DSL Symbol Mapping
Concept
DSL Syntax
Rendering Logic
Rules Source
Start Diagram
sequence
Initialize Canvas
-
Actor
actor Name
Draw Stick Figure


Boundary
boundary Name
Draw Circle+T


Sync Call
->
Solid Line, Filled Arrow


Async Call
->>
Solid Line, Open Arrow


Return
-->
Dashed Line, Open Arrow


Create
create Name
Start lifeline at Y-pos


Destroy
destroy Name
End lifeline with *


Alternative
alt [Cond]
Draw Frame with label




8. Conclusion
The specification outlined in this report successfully merges the restrictive, pedagogical requirements of the provided Course Guide with the expansive, technical robustness of the UML 2.5.1 specification. By explicitly defining the syntax for mandatory elements like Actors (Nouns), Asterisk-based destruction, and BCE stereotypes, the DSL ensures that students can generate diagrams that meet their grading criteria. Simultaneously, by mapping these simple terms to the underlying UML metamodel (Lifelines, ExecutionSpecifications, MessageSorts) and expanding the syntax to include loops, breaks, and precise arrow types, the DSL provides a scalable path for users to transition from classroom exercises to professional architectural modeling. The inclusion of a "Strict Mode" in the compiler provides the necessary enforcement mechanism to validate the unique "Creator-Deletes" lifecycle rule, ensuring the tool is not just a drawing utility, but a semantic validator for software design.
Sources
AMS_Partea_I_RO.doc (General UML Course Context)
Regulile sintaxei Diagrama Secvențelor.pdf (Primary Course Guide)
Regulile sintaxei Diagrama Secvențelor.pdf (Analysis of Entities/Syntax)
Regulile sintaxei Diagrama Secvențelor.pdf (Analysis of Rules)
StackExchange (Destruction Notation Analysis)
PlantUML Documentation (Numbering)
OMG UML 2.5.1 Specification (About UML)
IBM Docs (Message Types)
StackExchange (Message Sorts & Creation)
UML Diagrams.org (Combined Fragments)
UML Diagrams.org (Lifeline/Execution Specification)
IBM Docs (Creating Lifelines)
UML Diagrams.org (Interaction Operators)
PlantUML Documentation (Stereotype Keywords)
