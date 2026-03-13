Language Specification for Activity: A Comprehensive DSL Architecture Merging Educational Constraints with OMG UML 2.5.1 Standards
1. Executive Summary
This document constitutes the definitive Language Specification for Activity, a domain-specific language (DSL) and associated transpilation architecture designed to model behavioral workflows. This specification arises from a critical architectural need: to reconcile the stringent, pedagogically driven constraints of a specific academic curriculum ("The Teacher's Core") with the rigorous, industrial-strength semantics of the Object Management Group (OMG) Unified Modeling Language (UML) Specification Version 2.5.1.
The mandate for this specification is threefold. First, it must formalize a "Course Guide" that imposes strict syntactic limitations—most notably the singularity of initial and final nodes and the mandatory application of guard conditions on decision nodes—rules that are often relaxed in standard industry practice but are essential here for structural correctness. Second, it must ground these simplified rules in the formal metamodel of UML 2.5.1, ensuring that the DSL is not merely a toy language but a valid profile of the standard, capable of supporting token flow semantics, concurrency, and partitioning. Third, it must synthesize a concrete syntax that is interoperable with, yet distinct from, existing text-to-diagram tools like PlantUML and Mermaid, serving as a strict "frontend" validator before generating code for those permissive "backend" renderers.
This report is written from the perspective of a Senior Software Architect and Language Engineer. It eschews superficial descriptions in favor of deep structural analysis, providing a blueprint for compiler implementation, semantic validation logic, and graph topology management. The document is structured to guide the implementer from the high-level constraints (Teacher's Core) through the theoretical underpinnings (UML Spec Expansion) to the practical implementation (DSL Definition) and finally into the complex domain of layout algorithms and edge case handling.

2. The "Teacher's Core": Formalizing Pedagogical Constraints
The "Teacher's Core" defines the primary normative requirements for the Activity DSL. Derived from the provided Course Guide and AMS_Partea_I_RO.doc , these rules represent a strict subset of UML. Unlike general-purpose modeling tools that allow for loose drafting (e.g., unconnected nodes, missing guards, multiple start points), the Activity DSL treats these pedagogical constraints as hard syntax errors. This section deconstructs these rules, analyzing their implications for language design and validation.
2.1. Structural Cardinality and Boundaries
The most significant deviation from standard loose modeling practices in the Teacher's Core is the imposition of strict cardinality on the graph boundaries.
2.1.1. The Singularity of Entry: The Initial Point
The Course Guide explicitly states: "A diagram can have only one single initial point". In the provided documentation, this is referred to as "Punctul inițial" and is visually represented as a filled circle.
Constraint Analysis: In standard UML 2.5.1, an Activity may have zero, one, or multiple Initial Nodes. Multiple initial nodes imply concurrent threads starting simultaneously upon the invocation of the Activity. By restricting this to exactly one, the Teacher's Core simplifies the execution model to a single thread of control at instantiation. This eliminates race conditions at startup and simplifies the reachability analysis for the compiler.
DSL Implication: The DSL must enforce a "Global Scope" validation rule. The parser must count occurrences of the start token. Count == 0 is a fatal error (unreachable code), and Count > 1 is a fatal error (ambiguous entry).
Visual Semantics: The DSL generator must render this as a solid black circle, placing it structurally at the top-left or top-center of the partition defined as the entry point.
2.1.2. The Singularity of Exit: The Final Point
Similarly, the guide enforces: "A diagram can have only one single final point". This is termed "Punctul final" and corresponds to the UML Activity Final Node.
Constraint Analysis: This is a severe constraint compared to standard UML, which allows multiple Activity Final Nodes (all terminate the entire activity) and Flow Final Nodes (which terminate only a specific path). The requirement for a single unique exit point forces the modeler to explicitly merge all concurrent or alternative flows before termination. This teaches the student the importance of "cleanup" and structural convergence.
Logic implication: It forbids "dangling threads." If a process splits into three parallel tasks, they cannot just end; they must be explicitly joined (synchronized) and then merged into the final node.
DSL Implication: The compiler must perform a graph traversal (likely Depth-First Search or DFS) from the Initial Node. All paths must eventually converge to the single declared stop node. Any path ending in a sink node that is not the declared Final Point constitutes a "Dangling End" error.
2.2. The Executable Unit: "Activity" (Action)
The Course Guide uses the term "Activity" to describe the atomic unit of work , although in UML 2.5.1 terminology, this is technically an "Action." The Activity Diagram models the sequencing of these Actions.
2.2.1. Naming Conventions and Linguistic Validation
The guide imposes a strict naming convention: "The name of an activity is a conjugated verb (e.g., Se loghează, Conectează, Deconectează, Salvează)".
Linguistic Analysis: This rule enforces the "Action" semantic. Noun phrases like "User Database" or "Inventory System" are valid Object Nodes or Partitions but are semantically invalid as Actions. An Action must represent a change in state or a computation.
DSL Implication: While full Natural Language Processing (NLP) might be overkill, the DSL's static analyzer should ideally include a heuristic check. For Romanian (as per the source text), this means checking for verb endings or checking against a dictionary. For the general DSL, enforcing a structure like Verb + Noun (e.g., "Check Balance") via regex (e.g., ^[A-Z][a-z]+ [A-Z][a-z]+) is a recommended "Warning" level validation.
2.2.2. Visual Representation
The entity is represented as a rectangle with rounded corners. The DSL must ensure that standard rendering engines (PlantUML/Mermaid) use this specific shape, distinguishing it from sharp-cornered rectangles (often used for objects or classes) or other shapes.
2.3. Control Logic: The Strict Separation of Decision and Merge
Perhaps the most critical pedagogical constraint—and the one most valuable for a rigorous DSL—is the semantic and syntactic separation of the Diamond symbol into two distinct, mutually exclusive logical operators: the Decision Block and the Merge (Ramificatorul).
2.3.1. The Decision Block (Bloc de decizie)
The guide defines this as representing "certain verifications".
The Guard Constraint: "The Decision Block ALWAYS VA HAVE (always will have) noted the guard conditions".
Implication: A decision node without guards is syntactically invalid. In standard modeling, one might lazily draw an arrow labeled "Yes" and another "No" without formal bracketed guards. The DSL must reject this. Every outgoing edge from a decision block must have a formal predicate defined in brackets [condition].
Semantic Integrity: This ensures that the flow is deterministic (or at least explicitly conditional). It prevents the creation of "Implicit Splits" where the reason for divergence is unknown.
2.3.2. The Merge Node (Ramificatorul)
The guide defines this as connecting "multiple transitions together".
The Guard Constraint: "The Ramificatorul NEVER NU VA AVEA (never will have) noted guard conditions".
Implication: This is a purely structural node used to coalesce flow. Standard UML often uses the same diamond shape for both, leading to confusion. By enforcing that a Merge cannot have guards, the DSL forces the user to understand that no decision is being made here—control is merely passing through.
Flow Logic: Logical OR (or XOR in token terms). If a token arrives on any incoming edge, it is passed to the outgoing edge.
2.4. Concurrency: Fork and Join
The guide distinguishes between sequential and parallel flows using Fork and Join bars.
Fork: "Ramifies two or more activities that happen in parallel."
Join: "Waits for the fulfillment of two or more activities and connects them."
Synchronization Constraint: The definition of Join implies a Barrier Synchronization. It does not merely merge flows; it "waits" (Asteapta). This maps to the UML "AND" logic.
DSL Implication: The DSL must support block structures for concurrency. A fork block should ideally be closed by a join block to ensure the graph is well-structured (structured programming loops). While "goto" style connections are possible, a par {... } syntax is safer and prevents mismatch errors where a fork is never joined.
2.5. Partitions (Swimlanes)
The guide mentions Partiţia as a "responsible part."
Visuals: Represented as swimlanes (vertical or horizontal).
Semantics: Every Action belongs to a Partition.
DSL Implication: The DSL must support scoping. Actions defined within a partition "Name" {... } block are visually rendered inside that swimlane. This is crucial for "Who does what" analysis in process modeling.

3. The "UML Spec" Expansion: Metamodel Alignment
While the Teacher's Core provides the validation rules, the OMG UML 2.5.1 Specification provides the rigorous semantic foundation required to implement the DSL robustly. This section maps the teacher's simplified terms to the formal UML 2.5.1 metamodel, filling in gaps regarding token flow, edge weights, and node attributes that are necessary for a working compiler.
3.1. The Metamodel Hierarchy
To build a type-safe DSL, we must define the class hierarchy based on UML 2.5.1. The Teacher's entities are concrete instantiations of abstract UML metaclasses.
3.1.1. ActivityNode
The abstract base class for all nodes in the diagram.
UML 2.5.1 Definition: ActivityNode is an abstract class that represents points in the flow of an Activity.
DSL Attributes:
name: String (Mandatory).
inPartition: Reference to ActivityPartition (Mandatory in this DSL).
incoming: Set of ActivityEdge references.
outgoing: Set of ActivityEdge references.
redefinedNode: Inheritance mechanism (Advanced, likely distinct from Teacher's scope but essential for architectural completeness).
3.1.2. ControlNode Subclasses
The "Initial," "Final," "Decision," "Merge," "Fork," and "Join" are all ControlNode types. They coordinate flow but do not perform "work" (execution of behaviors).
InitialNode: A control node that emits a token on each outgoing edge when the Activity is invoked.
Teacher's vs. Spec: The Teacher allows only one. UML allows many. The DSL restricts the instance count of this class to 1.
ActivityFinalNode: A control node that stops all executing flows in the Activity.
Critical Semantics: In UML 2.5.1, reaching an ActivityFinalNode destroys all tokens in the graph, terminating the entire process immediately. This is distinct from FlowFinalNode, which destroys only the token that reaches it. The Teacher's guide shows a bullseye (ActivityFinal), implying strict termination.
DecisionNode: A control node that chooses between outgoing flows.
Token Logic: It accepts a token on an incoming edge and offers it to outgoing edges. The guard conditions on outgoing edges are evaluated. The token traverses one and only one edge (XOR semantics).
The "Else" Guard: UML 2.5.1 suggests an [else] guard to ensure flow continues if specific conditions fail. The DSL should implicitly or explicitly enforce an else branch to prevent "stuck" tokens, satisfying the Teacher's requirement for rigorous logic.
MergeNode: A control node that brings together multiple alternate flows.
Token Logic: It does not synchronize. If a token arrives from path A, it passes through. If later a token arrives from path B, it passes through. This is "OR" logic.
Architecture: It is stateless; it does not hold tokens.
3.1.3. ExecutableNode (Action)
The Teacher's "Activity" maps to Action, which is an ExecutableNode.
UML 2.5.1 Definition: An Action is the fundamental unit of executable functionality. The execution of an Action represents some processing or transformation.
Attributes to Expose in DSL:
isLocallyReentrant: Boolean. (Can this action fire again while a previous instance is running? Default to false for simple educational models).
localPrecondition / localPostcondition: Constraints. The DSL could support annotations for these, mapping to the Teacher's "Comment" or specific note attachments.
3.2. ActivityEdge and Token Flow Semantics
The connections (Transitions) in the Teacher's guide are formally ActivityEdge elements in UML 2.5.1.
3.2.1. Guard and Weight
Guard: A ValueSpecification that evaluates to a Boolean. As per the Teacher's Core, this is mandatory on Decision outputs.
Syntax: [ condition ].
Weight: UML 2.5.1 defines weight as the minimum number of tokens required to traverse the edge.
Educational Context: Usually weight=1. The DSL should default to this but allow advanced syntax (e.g., {weight=2}) for future-proofing, even if the Teacher's guide ignores it.
3.2.2. ControlFlow vs. ObjectFlow
ControlFlow: Edges connecting Actions or ControlNodes. They carry "Control Tokens" (markers of execution state).
ObjectFlow: Edges that carry data (Objects/Data Tokens).
Gap Analysis: The Teacher's guide focuses on process flow (ControlFlow). However, true UML 2.5.1 often mixes them. A "Senior Architect" approach dictates that the DSL should type its edges. If an edge connects an Action to an Action, it is a ControlFlow. If the DSL supports ObjectNode (data buffers), edges connecting them must be ObjectFlow. To keep the DSL simple for the course but valid for UML, we will primarily model ControlFlow but reserve syntax for data passing.
3.3. ActivityPartition (Swimlanes)
UML 2.5.1 defines ActivityPartition as an ActivityGroup.
Attributes: isDimension, isExternal.
Semantics: Partitions do not affect the token flow logic (tokens can jump across lanes), but they represent ownership.
Layout Logic: In the DSL, partitions act as containers. The Teacher's guide shows vertical partitions. The DSL needs to support defining partition blocks that visually contain the nodes defined within them.

4. The DSL Definition
This section defines the concrete syntax of the Activity Language. The design philosophy favors a structured, C-style block syntax (similar to PlantUML's new beta syntax ) over a purely graph-based syntax (like Mermaid ), as block structures better enforce the nesting and scoping rules required by Partitions and structured concurrency.
4.1. Formal Grammar (EBNF Specification)
The following Extended Backus-Naur Form (EBNF) describes the valid syntax for the Activity DSL.
EBNF
/* Root Definition */
activityDiagram ::= "activity" ID "{" body "}"

body ::= (element | connection)*

element ::= partition | node

/* Grouping */
partition ::= "partition" ID "{" (node)* "}"

/* Node Types */
node ::= startNode 

| endNode 
| actionNode 
| decisionBlock 
| mergeNode 
| forkNode 
| joinNode

/* Cardinality Rule: Compiler checks only 1 startNode exists globally */
startNode ::= "start" (ID)? ";"

/* Cardinality Rule: Compiler checks only 1 endNode exists globally */
endNode ::= "stop" (ID)? ";"

/* Teacher's Rule: ID/String should be a conjugated verb */
actionNode ::= "action" IDString ";"

/* Control Structures */
/* Teacher's Rule: Decision MUST have guards */
decisionBlock ::= "decision" ID "{" (decisionBranch)+ "}"
decisionBranch ::= "on" guardCondition "goto" targetID ";"

guardCondition ::= ""

/* Teacher's Rule: Merge NEVER has guards */
mergeNode ::= "merge" ID ";"

forkNode ::= "fork" ID ";"
joinNode ::= "join" ID ";"

/* Implicit Flow vs Explicit Connection */
/* Nodes defined sequentially imply flow unless inside a block structure */
connection ::= sourceID "-->" targetID (":" labelString)? ";"

IDString ::= '"' StringContent '"' | ID

4.2. Syntax Explanation and Validation Logic
4.2.1. The Partition Scope
Instead of tagging every node with a partition attribute, the DSL uses scope.
partition Customer {
start;
action "Request Login";
}
Validation: The compiler assigns the ActivityPartition "Customer" to the Initial Node and the Action "Request Login".
4.2.2. The Strict Decision Syntax
To enforce the "Mandatory Guard" rule, the DSL does not allow simple arrows from a decision node. It requires a structured block.
decision CheckCredentials {
on [Valid] goto EnterSystem;
on [Invalid] goto ShowError;
}
Validation: If the user attempts to create a decision node without an on [...] block, the parser throws Error 101: Decision Logic Missing Guards. This makes it impossible to violate the Teacher's Core constraint.
4.2.3. The Merge Syntax
To enforce the "No Guard" rule, the Merge syntax is purely a target declaration.
merge LoginMerge;
ShowError --> LoginMerge;
Validation: You cannot attach a guard to an incoming arrow of a Merge node in this DSL; guards are properties of outgoing edges from Decisions. This prevents the confusion of placing a condition on a convergence point.
4.2.4. Actions and Verbs
action A1 "Se loghează";
Validation: The DSL compiler will extract the string "Se loghează". While it cannot fully parse Romanian grammar, it can check for common verb endings or simply warn if the label is identical to a known object type, prompting the student to use a verb.
4.3. Comparison with Existing Tools
Feature
Activity DSL (This Spec)
PlantUML (Beta/New)
Mermaid.js
Initial Node
Enforces exactly one (Error otherwise)
Allows multiple start
Allows multiple start
Decision Guards
Mandatory in syntax (on [...])
Optional (yes) labels
Optional `
Merge Nodes
Distinct merge keyword
Implicit endif or merge
Generic diamond {}
Partitioning
Scoped Block partition {}
Scoped partition {}
Scoped subgraph
Naming
Enforces Verb Strings
Arbitrary text
Arbitrary text
Validation
Strict (Teacher's Constraints)
Permissive (Render anything)
Permissive (Render anything)

Architectural Insight: This DSL acts as a Constraint Enforcer. Code written in this DSL can be transpiled into PlantUML or Mermaid for rendering, but the compilation step ensures the diagram is valid according to the course rules before the rendering tool ever sees it.

5. Edge Cases, Layout, and Rendering Considerations
The translation of a textual description into a 2D graph involves complex challenges, particularly when enforcing strict topological constraints.
5.1. Handling Layout Ambiguities
5.1.1. The Back-Edge Problem (Loops)
Process flows often contain loops (e.g., "Invalid Password" -> "Retry").
Challenge: Hierarchical layout algorithms (like Sugiyama, used by Graphviz/PlantUML) represent time flowing downwards. Loops create "back edges" that point upwards, which can distort the layout.
DSL Solution: The DSL should identify back edges (edges pointing to a node already visited in the depth-first traversal). When generating backend code (e.g., for PlantUML), these specific edges should be tagged with [norank] or constraint=false hints to prevent them from messing up the swimlane alignment.
5.1.2. Partition Crossings
A transition might go from Partition A to Partition B.
Challenge: Minimizing edge crossing in complex diagrams.
DSL Solution: The DSL compiler should conceptually order partitions based on connection density. If Partition A interacts mostly with Partition C, placing Partition B between them creates visual clutter. The DSL can implement a heuristic: "Place highly connected partitions adjacent to each other."
5.2. Semantic Edge Cases
5.2.1. The "Dead End" Decision
Scenario: A student creates a Decision Node with [Valid] going to Action A but forgets the [Invalid] branch.
Teacher's Rule: The diagram implies a complete process.
Validation: The DSL compiler should issue a Warning: "Decision Node 'X' has non-exhaustive guards. Flows may get stuck." It might recommend adding an [else] branch, consistent with UML 2.5.1 best practices.
5.2.2. Merge vs. Join Confusion
Scenario: Merging parallel flows with a Merge node (Diamond) instead of a Join node (Bar).
UML Violation: This creates a Race Condition. The Merge node passes the first token it sees. The second token arriving later (from the parallel task) will trigger the subsequent action a second time, creating duplicate processes.
DSL Validation: The compiler must track "Concurrency Level."
Start: Level 0.
After Fork: Level +1.
The compiler checks if a merge node receives edges from a context where Level > 0. If so, it throws Error 202: Parallel flows must be synchronized with a Join, not a Merge. This is a sophisticated check that prevents logical errors that visual tools typically ignore.
5.3. Rendering the "Teacher's Visuals"
The visual requirements must be strictly mapped to the backend renderer:
Guard Placement: Guards must be rendered adjacent to the Decision diamond. In PlantUML, this maps to -> [Guard]. In Mermaid, -->|Guard|.
Comment Placement: Comments must be rendered on the transition line but distinct from guards. The DSL syntax --> Target : "Comment" ensures this separation.
Shapes:
Activity: RoundCornerRect (Standard).
Decision/Merge: Diamond.
Fork/Join: Black Bar (Thick line).

6. Conclusion and Future Outlook
This Language Specification defines a robust, strictly typed DSL for Activity Diagrams that satisfies the specific pedagogical requirements of the provided Course Guide while maintaining semantic consistency with the OMG UML 2.5.1 standard.
By enforcing constraints at the compilation level—specifically the Singleton Initial/Final Node, the Mandatory Decision Guards, and the Prohibition of Merge Guards—the Activity DSL serves as an automated tutor, preventing students from forming bad modeling habits. It elevates the diagramming process from simple drawing to architectural engineering, where the structure of the text guarantees the validity of the logic.
Furthermore, the mapping to the UML 2.5.1 metamodel ensures that this tool is not a dead-end. As students advance, the DSL can be extended to support ObjectNodes (Data Flow), SignalReceipt (Event processing), and InterruptibleRegions without breaking the core grammar defined here. This bridge between educational constraint and industrial power is the defining feature of the Activity DSL architecture.
Table 1: DSL Mapping Summary
Teacher's Term
UML 2.5.1 Metaclass
DSL Keyword
Validation Rule
Initial Point
InitialNode
start
Global Count == 1
Final Point
ActivityFinalNode
stop
Global Count == 1
Activity
Action
action
Name must be Verb Phrase
Bloc de decizie
DecisionNode
decision
Must have on [guard] branches
Ramificatorul
MergeNode
merge
Cannot have guards
Fork/Join
ForkNode/JoinNode
fork/join
Must pair correctly (Concurrency check)
Partiția
ActivityPartition
partition
Scoped nesting

This specification stands ready for immediate implementation as a parser-validator-generator pipeline.
