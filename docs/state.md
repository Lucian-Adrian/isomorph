Comprehensive Language Specification for the 'State' Domain Specific Language (DSL): Bridging Pedagogical Constraints and Industrial Standards
Executive Summary
This research report serves as the definitive Language Specification for the State Domain Specific Language (DSL), a textual modeling language engineered to generate State Machine Diagrams. This specification is the result of a rigorous architectural synthesis, merging three distinct strata of requirements to produce a tool that is both pedagogically compliant and industrially robust.
The primary directive of this specification is to operationalize the "Teacher's Core," a set of constraints derived from specific educational course materials (Regulile sintaxei Diagrama stărilor.pdf and AMS_Partea_I_RO.doc). These documents define the "must-have" elements and strict syntactical rules—such as the requirement for state names to be verbs—that form the validation layer of the DSL. However, a functioning software tool cannot exist on constraints alone. To build a viable text-to-diagram engine, we must bridge the significant implementation gaps in the educational material using the OMG Unified Modeling Language (UML) Specification Version 2.5.1. This secondary source provides the necessary metamodel attributes, execution semantics, and visual standards required for code generation and unambiguous communication. Finally, we integrate complementary insights from established industry tools like PlantUML, Mermaid, and Enterprise Architect to ensure the DSL's syntax is intuitive and maintainable.
This document is structured to guide a development team through the entire lifecycle of the DSL's implementation, from the abstract syntax tree (AST) definition to the rendering logic. It provides an exhaustive analysis of mandatory elements, expands upon them with standard UML attributes missing from the source files, and defines a concrete syntax that satisfies all stakeholders.

1. The "Teacher's Core" Specification
The "Teacher's Core" represents the foundational requirements derived directly from the provided educational materials. As the Senior Software Architect, I interpret these not merely as guidelines but as the strict validation profile of the DSL. Any deviation from these rules in the user's input must trigger specific compiler warnings or errors to ensure educational compliance.
1.1 Analysis of Primary Sources
The specification draws from two key documents uploaded by the user:
Regulile sintaxei Diagrama stărilor.pdf: This file provides the visual lexicon and naming conventions. It establishes the "vocabulary" of the diagram (e.g., Initial Point, Final Point, State, Transition).
AMS_Partea_I_RO.doc: This document provides the broader theoretical context, specifically in Chapter 5: Diagrama de stări (statechart diagram). It defines the "grammar" of the diagram, elaborating on automata, events, and complex state structures like concurrent substates.
1.2 Mandatory Elements
The following entities are explicitly required by the course materials and must be first-class citizens in the DSL. The DSL's parser must be able to identify, instantiate, and validate these specific objects.
Entity
Teacher's Definition
Cardinality & Logical Rules
Punctul Inițial (Initial Point)
Represents the beginning of a diagram. It is the starting point for the state machine's execution.
Strict Constraint: A diagram (or region) implies a single thread of control initiation. Therefore, a diagram can have only one single initial point.
Punctul Final (Final Point)
Represents the end of a diagram or the termination of the process.
Constraint: One or more final points are allowed. If multiple exist, they must have distinct names (e.g., "Final 1", "Final 2", "DocumentSalvat") to disambiguate the termination outcome.
Starea (State)
A stage or part of the system's work process. It represents a condition of the system.
Constraint: Must encompass properties for a specific Name and allow for internal actions or nested structures. The state persists for a duration.
Stare Compusă (Composite State)
A state composed of multiple sub-states. It encapsulates complexity.
Constraint: The DSL must explicitly support three specific structural topologies defined in the guide:

1. Concurente (Concurrent/Parallel): Substates executing simultaneously.

2. Depuse (Nested): Hierarchical decomposition.

3. Disjuncte (Disjoint): Mutually exclusive substates.
Tranziția (Transition)
The relationship representing movement between two states.
Constraint: Must connect exactly two states (source and target). It is the mechanism of change in the diagram.

1.3 Mandatory Syntax and Naming Conventions
The course guide imposes strict linguistic and syntactical rules. These are unique to this specific educational context and differ from standard UML, which is generally agnostic regarding naming parts of speech.
1.3.1 State Naming Convention
Rule: The name of a state must fundamentally describe an action or a status resulting from an action. It must be either:
A Verb in the Infinitive (e.g., Logare [Logging], Conectare [Connecting], Salvare).
A Participle (e.g., Conectat [Connected], Eliberat, Achitat [Paid], Actualizat [Updated]).
Architectural Implication: The DSL compiler needs a "Linguistic Validator." While full Natural Language Processing (NLP) might be overkill, the validator should check for common suffixes in the target language (Romanian) that indicate verbs or participles (e.g., -are, -at, -ut, -it) and issue a warning if the name appears to be a noun (e.g., "User").
1.3.2 Guard Conditions
Syntax: Guard conditions must be textually enclosed in square brackets [...].
Example: [yes], [valid card].
Logic: The document defines a guard as information that acts as a gatekeeper. "When the condition is fulfilled, the system continues its work process; otherwise, the process repeats or interrupts". This implies a boolean evaluation.
1.3.3 Comments vs. Actions
Definition: The teacher defines a Comentariu (Comment) as a message written on the transition relationship. Its stated purpose is "explaining the process detailedly".
Ambiguity Resolution: In standard UML, text on a transition usually denotes a Trigger or an Effect (Action). The teacher's definition blurs this line. However, since the goal is "explanation," this maps semantically to a Note attached to the transition or a Label that is purely descriptive, rather than executable code. The DSL must support a specific field for this "Explanatory Message" distinct from the technical Guard.

2. The "UML Spec" Expansion (The Missing Pieces)
The "Teacher's Core" provides the high-level shape of the diagram but lacks the technical depth required to implement a robust modeling tool. It treats states as simple boxes and transitions as simple lines. To create a functioning software tool that can support code generation, simulation, or even accurate visual rendering, we must expand this specification using the OMG Unified Modeling Language (UML) Specification Version 2.5.1.
This section identifies the "gap" attributes—standard UML properties that are not mentioned in the teacher's file but are essential for the underlying metamodel.
2.1 The State Entity Expansion
In the Teacher's Core, a State is defined primarily by its name. In the UML Metamodel (Section 14.2 of ), a State is a Vertex that models a situation during which some invariant condition holds. To support this, we must add the following attributes to the DSL.
2.1.1 Standard UML Attributes for State
entry (Behavior)
Definition: An optional behavior that is executed whenever the state is entered, regardless of the transition taken to reach it.
Necessity: The teacher's file mentions "processes" within states. In software, initialization logic (e.g., resetting a counter) typically happens on entry.
DSL Implementation: We must support a keyword like entry: or on_entry: to define this action.
exit (Behavior)
Definition: An optional behavior executed whenever the state is exited.
Necessity: Essential for cleanup actions (e.g., closing a connection). Without this, the model cannot guarantee resource safety.
DSL Implementation: Support for exit: or on_exit:.
doActivity (Behavior)
Definition: An optional behavior that executes while the state is active. Unlike entry and exit, which are atomic and run-to-completion, doActivity is interruptible.
Necessity: The teacher's definition of a state as a "stage of work" strongly implies duration. A "Processing" state implies a doActivity that continues until finished or interrupted.
DSL Implementation: Support for do: or activity:.
deferrableTrigger (Trigger)
Definition: A list of triggers that are not handled in the current state but are postponed until the system transitions to a state that can handle them.
Necessity: While advanced, this is critical for robust state machines (e.g., a "Buffer" state handling input).
isSimple, isComposite, isOrthogonal
Definition: Derived properties in UML. A state is composite if it has regions; orthogonal if it has more than one region.
Necessity: These flags drive the layout engine. A composite state must be drawn as a container; an orthogonal state must have dashed dividers.
2.1.2 Standard UML Relationships for States
Internal Transition (internal)
Definition: A transition that executes an effect without exiting or re-entering the state.
Necessity: The teacher's file describes "work" inside a state. Often, an event (like a timer tick) causes an update without changing the state.
DSL Implementation: Syntax to define transitions inside the state block that do not point to another state (e.g., Event / Action).
2.2 The Transition Entity Expansion
The Teacher's Core defines a transition simply as a relationship. UML 2.5.1 (Section 14.2.4) defines a Transition as a complex directed relationship with three distinct parts: Trigger, Guard, and Effect.
2.2.1 Standard UML Attributes for Transition
trigger (Event)
Definition: Specifies the event that initiates the transition.
Gap Filler: The teacher's file mentions "Trigger" implicitly in examples but conflates it with the guard or comment. The DSL must strictly separate the Trigger (What happened?) from the Guard (Is it allowed?).
Types to Support:
CallEvent: Receiving a request.
SignalEvent: Receiving an asynchronous signal.
ChangeEvent: A boolean condition becomes true.
TimeEvent: A time expression (e.g., "after 5s").
guard (Constraint)
Definition: A boolean expression that must be true for the transition to fire.
Alignment: This aligns perfectly with the teacher's [Condiția de gardă].
Attribute: body (OpaqueExpression) to store the text "yes" or "x > 5".
effect (Behavior)
Definition: An optional behavior executed during the transition, after the source state is exited and before the target state is entered.
Gap Filler: The teacher's "Comment" is described as explaining the process. In a functional tool, this "explanation" often corresponds to the code that runs (the Effect). The DSL should allow mapping the teacher's "Comment" to the UML Effect for code generation, or to a Note for documentation.
kind (TransitionKind)
Definition: Defines the semantics of the transition :
external (Default): Exits source, enters target.
local: Transition to a substate that does not exit the container.
internal: Event handling without state change.
2.3 Missing Pseudostates (Gap Fillers)
The Teacher's Core mentions "Concurrent" and "Disjoint" states and "Final" points. However, it misses the specific control nodes (Pseudostates) required to implement the logic of concurrency and branching described in the text.
Fork (Pseudostate)
Requirement: Necessary to implement the teacher's "Concurrent State" (Fig 3 in ). A transition cannot simply "split" without a fork node in UML.
Visual: A solid black bar.
Join (Pseudostate)
Requirement: Necessary to merge concurrent regions back into a single flow of control.
Visual: A solid black bar.
Choice (Pseudostate)
Requirement: The teacher's guide discusses guards where "if condition met, continue; else, repeat." This implies a dynamic branch. A Choice node allows for dynamic evaluation of guards after the transition has started.
Visual: A diamond shape.
Junction (Pseudostate)
Requirement: A static merge/branch point used to chain transitions together (compound transitions).
Visual: A filled circle (smaller than Initial).
History (Deep & Shallow)
Requirement: Implicit in the concept of "Nested" states. If a process is interrupted and then resumed, does it restart at the beginning or where it left off? UML History states handle this.
Visual: A circle containing an 'H' (Shallow) or 'H*' (Deep).
EntryPoint / ExitPoint
Requirement: For structured entry/exit into composite states, preserving encapsulation.
Visual: Circles on the boundary of the state.

3. The DSL Definition (The Code Structure)
This section defines the concrete syntax of the State DSL. The syntax is designed to be concise, declarative, and strictly typed to support the "Teacher's Core" validation rules while accommodating the UML 2.5.1 expansion. It draws inspiration from the clean syntax of PlantUML and Mermaid but enforces the specific naming and structural constraints required by the user.
3.1 Global DSL Layout
The language uses a block-based structure. The root element is stateDiagram.
stateDiagram {
// Global Properties
direction: TB // Top-to-Bottom (default) or LR (Left-to-Right)
// Entity Definitions
// Connection Definitions

}
3.2 Entity Definitions
Entity: State (Simple)
DSL Keyword: state
Visual Style:
Shape: Rectangle with rounded corners (Radius ~10px).
Border: Solid thin line (1px), black (#000000).
Fill: White (#FFFFFF) or light gray (#F2F2F2).
Font: Sans-serif (Arial/Helvetica), center-aligned.
Compartments: Optional horizontal line separating Name from Internal Actions (entry/do/exit).
Properties:
name (ID): Unique identifier (PascalCase recommended).
label (String): Display text. Validation: Must be a Verb/Participle (Teacher's Rule).
entry (Action): Executed on entry.
exit (Action): Executed on exit.
do (Action): Long-running activity.
Connections: Can be Source or Target of transitions.
Syntax:
state {
label: "Logare" // Validates against Verb/Participle rule
entry: "initialize()"
do: "pollServer()"
exit: "cleanup()"
}
// Shorthand
state as "Label"
Entity: Composite State (Nested)
DSL Keyword: composite or implicit via nesting syntax.
Visual Style:
Shape: Large rounded rectangle containing other states.
Divider: Solid line separating the Name compartment from the internal region.
Properties: Same as Simple State, plus an implicit region.
Syntax:
state {
label: "Conectat"
// Nested States (Teacher's Rule: Sub-stări depuse)
state {... }
state {... }

// Transitions inside
-->


}
Entity: Concurrent State (Orthogonal)
DSL Keyword: concurrent or separator || / --.
Visual Style:
Shape: Large rounded rectangle divided into regions by dashed lines.
Teacher's Alignment: Corresponds to "Sub-stări concurente".
Syntax:
state {
label: "Procesare"
region {
    // Region 1 logic
    [*] --> StepA
}
--  // Dashed Line Separator
region {
    // Region 2 logic
    [*] --> StepB
}


}
Entity: Initial Point
DSL Keyword: [*] or start.
Visual Style: Solid filled black circle.
Properties: None. Singleton per region.
Connections: Source for exactly one transition per region.
Validation: Parser must throw error if > 1 per region.
Entity: Final Point
DSL Keyword: [*] or final or end.
Visual Style: Circle surrounding a smaller filled circle (Bullseye).
Properties: name (Required by Teacher's Rule if multiple exist).
Syntax: final as "DocumentSalvat"
Entity: Pseudostates (Gap Fillers)
Fork/Join:
Keyword: fork, join.
Visual Style: Thick black bar (horizontal or vertical).
Choice:
Keyword: choice.
Visual Style: Diamond shape.
History:
Keyword: history or history* (deep).
Visual Style: Circle with 'H'.

3.3 Connection Definitions
The "Teacher's Core" simplifies a transition into a relationship with conditions and comments. We map this to the standard UML 2.5.1 Transition specification (Trigger [Guard] / Effect).
Connection: Transition
DSL Symbol: --> (Simple), -[kind]-> (Detailed).
Visual Style:
Line Style: Solid Line (Mandatory). Dashed lines are for dependencies, not state transitions.
Arrow Head: Open Arrowhead (V-shape).
Color: Black.
Properties:
trigger (Event Name).
guard (Condition): Boolean expression in brackets.
effect (Action): Procedural code executed during transition.
comment (Note): The Teacher's specific "Comment" field.
Logic:
Source exits -> Guard checked -> Effect executed -> Target entered.
UML Relationship: Association (Directed).
Syntax:
// Standard UML Notation
SourceID --> TargetID : Trigger [Guard] / Effect
// Teacher's Extended Notation (with explicit Comment)
SourceID --> TargetID {
trigger: "Click"
guard: "isValid"
action: "saveData()"
comment: "User attempts to save" // Teacher's 'Comentariu'
}

4. Edge Cases & Layout
This section addresses the complex scenarios where simple syntax breaks down, requiring specific handling rules in the DSL implementation.
4.1 Handling Nesting (Teacher's "Sub-stări Depuse")
Problem: A transition may point to a Composite State (Parent) without specifying a sub-state, or it may point directly to a sub-state (Parent.Child).
UML Rule:
Transition to Parent: Enters the Parent's Initial Point ([*]). If no initial point is defined, the model is ill-formed.
Transition to Parent.Child: Direct entry. The Parent's entry behavior is executed first, followed by the Child's entry.
DSL Handling:
Implicit Entry: A --> CompositeB (DSL automatically routes to CompositeB's [*] node).
Explicit Entry: A --> CompositeB.SubStateC (Visual line crosses the boundary of CompositeB to touch SubStateC).
Layout Logic: The renderer must use a "cluster" layout algorithm (like Graphviz subgraph). Transitions entering the cluster must be routed to avoid crossing too many internal lines.
4.2 Handling Concurrency (Teacher's "Sub-stări Concurente")
Problem: How to represent "splitting" control flow.
Rule: When entering a Concurrent State, all orthogonal regions activate simultaneously.
Layout: The renderer must draw a dashed line (separator) between regions. This is a critical visual distinction from nested states.
DSL Syntax: The use of -- or || separators in the DSL text triggers the "Orthogonal Region" layout mode in the rendering engine.
4.3 Handling Labels and "Comments"
Teacher's Comment vs. UML Effect:
The Teacher's file creates ambiguity between "Action" and "Comment".
Resolution: We support both visual styles.
Standard: Text centered on the line: Trigger [Guard] / Effect.
Teacher Mode: If a comment property is present, render it as a Floating Note (Yellow Sticky) connected to the transition line via a dashed trace. This satisfies the requirement for a "message explaining the process detailedly" without cluttering the technical transition signature.
4.4 Conflict Resolution
Scenario: A user defines a transition on a Child state (Child --> A) and a conflicting transition on the Parent state (Parent --> B) triggered by the same event.
UML Rule: Inner-most priority applies. The Child transition fires; the Parent transition is shadowed.
DSL Validation: The tool should issue a warning if transitions have overlapping guards without clear priority, as this creates non-deterministic behavior.
4.5 The "Teacher's Naming" Validator
Implementation Logic:
Upon parsing state as "Label", the validator executes a regex check on "Label".
Check 1: Is it a single word or short phrase?
Check 2: Does it end in typical verb/participle suffixes (Romanian context: -are, -at, -ut, -it)?
Result: If validation fails -> Warning: "State name '{Name}' does not comply with strict naming rules (Must be Verb/Participle per Course Guide)."

5. Comparative Tooling Analysis
To ensure this specification is practical, we compare the proposed DSL against industry standards.
Feature
Teacher's Core
UML 2.5.1 Spec
PlantUML
Mermaid.js
Enterprise Architect
Proposed DSL Strategy
State Naming
Strict (Verbs only)
Open (Any string)
Open
Open
Open
Strict Validation Layer (Warns on non-verbs).
Transition Line
"Relationship"
Solid Line
--> (Solid)
--> (Solid)
Solid
Solid Line --> (Enforce standard).
Guard Syntax
[Condition]
[Constraint]
[Condition]
[Condition]
[Guard]
[...] (Universal standard).
Comments
On the line
Note attached
note on link
N/A
Note link
Note attached to Transition.
Composite
Depuse/Concurente
Composite/Orthogonal
state {... }
state {... }
Nested Element
Brace-based nesting {... }.
Fork/Join
Not defined
Pseudostates
<<fork>>
state... <<fork>>
Element
Keywords fork/join.

Insight: The proposed DSL adopts the declarative syntax of PlantUML (which is industry standard for text-to-diagram) but injects the specific semantic constraints of the Teacher's Core as a validation pass. This gives the student the "feel" of a real tool while keeping them within the educational guardrails.

6. Implementation Notes for the Architect
6.1 Parsing Strategy
Grammar: Use a PEG (Parsing Expression Grammar) parser. The strictly defined keywords (state, final, entry, exit, fork) make this grammar context-free and easy to parse without backtracking.
Tokenization: Treat --> as a single token ARROW. Treat [...] as a GUARD token.
6.2 Validation Layer
Implement a TeacherComplianceVisitor that traverses the AST post-parse to enforce:
Cardinality Check: Count of [*] nodes > 1 per region? -> Error.
Linguistic Check: State label matches Verb/Participle regex? -> Warning.
Uniqueness Check: Duplicate Final State names? -> Error.
6.3 Rendering
Engine: Map the AST to a graph layout engine like Graphviz DOT or Elk JSON.
Clusters: Use "subgraphs" or "clusters" for Composite States.
Routing: Use orthogonal routing for transitions to keep diagrams clean, especially when exiting nested states.

Conclusion
This specification provides a complete blueprint for the State DSL. By anchoring the design in the OMG UML 2.5.1 Specification, we ensure that the generated diagrams are technically correct and extensible. By overlaying the Teacher's Core as a strict validation profile, we ensure the tool meets the specific pedagogical goals of the user's course. The result is a hybrid language: strictly compliant with the educational rules on the surface, but powered by the robust, standardized engine of UML under the hood.

Sources
Regulile sintaxei Diagrama stărilor.pdf - User Provided File. (Primary source for naming and basic structure).
AMS_Partea_I_RO.doc - User Provided File. (Primary source for definitions of Automata, States, Transitions, and Event/Guard/Action syntax).
OMG Unified Modeling Language (UML) Specification Version 2.5.1. Object Management Group. (Secondary source for attribute gaps, pseudostate definitions, and execution semantics).
Mermaid.js State Diagram Documentation. (Complementary source for text-to-diagram syntax inspiration).
PlantUML State Diagram Reference. (Complementary source for composite state and concurrency syntax).
Sparx Systems Enterprise Architect User Guide. (Complementary source for property window attributes and visual standards).
IBM Rhapsody / Sparx Guidelines on Transitions. (Source for Trigger/Guard/Effect distinction).