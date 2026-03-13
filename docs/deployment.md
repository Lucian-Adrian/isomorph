Language Specification for Deployment Diagramming Domain-Specific Language (DDL)
1. Architectural Preamble and Metamodel Design Philosophy
The development of a Domain-Specific Language (DSL) for software architecture deployment requires a rigorous alignment between pedagogical constraints and industrial specifications. This document serves as the definitive language specification for the Deployment Description Language (DDL), a specialized text-to-diagram tool designed to model the physical deployment of artifacts on computational nodes. The architecture of this DSL is predicated on a hybrid metamodel that enforces the strict, simplified rules of the "Core Profile" defined in the provided Course Guide while seamlessly extending into the robust, standardized semantics of the OMG UML 2.5.1 Specification.
In the context of Model-Driven Engineering (MDE), the deployment diagram occupies a critical role, bridging the gap between logical software components and the physical infrastructure upon which they execute. While logical diagrams (Class, Sequence) describe code structure and behavior, deployment diagrams describe the execution environment, focusing on nodes (servers, devices) and the artifacts (files, libraries) they host. The challenge in this specification lies in reconciling the "Teacher's Core"—a restricted profile aimed at foundational learning—with the "UML Spec Expansion," which provides the necessary attributes for professional utility.
This report is structured to function as a complete implementation guide for compiler engineers and software architects. It delineates the lexical, syntactic, and semantic rules of the language, analyzing the ontological distinctions between processing nodes and peripheral devices as mandated by the primary source, and mapping these concepts to the standardized UML metamodel classes DeploymentTarget, Node, Device, and ExecutionEnvironment. By synthesizing these disparate sources, we establish a DSL that is both educationally compliant and professionally extensible.

2. The Core Profile: Analysis of Mandatory Pedagogical Constraints
The "Teacher's Core" represents the immutable kernel of the DSL. Derived from the provided "Course Guide" , this profile establishes a binary ontology for hardware infrastructure that deviates significantly from the generalized Node concept found in standard UML. These constraints function as the primary validation layer in the DSL's semantic analyzer.
2.1. Ontological Elements and Semantic Constraints
The Core Profile mandates a strict classification of physical entities based on their computational capability—specifically, their ability to "process" data. This functional distinction imposes specific validation rules on the DSL entities.
2.1.1. The Active Processing Node (Node)
The fundamental unit of the Core Profile is the Node (referenced as "Nod" in the source text).
Functional Definition: The guide explicitly defines a Node as an entity representing equipment or a device that PROCESSES data (PRELUCREAZĂ date). This definition elevates the Node from a generic location to an active computational agent. In the generated DSL, a Node is not merely a container; it is a semantic assertion that the entity possesses a CPU, memory, and the capability to execute instructions.
Mandatory Naming Convention: The identifier for a Node is strictly constrained to be a Noun (Substantiv). This rule serves a pedagogical purpose, enforcing the distinction between objects (nouns) and actions (verbs). The DSL parser must therefore implement or interface with a lightweight Natural Language Processing (NLP) heuristic or a morphological analyzer to warn users against verb-based identifiers (e.g., "Computing" or "Process").
Exemplars: The guide provides illustrative examples: "Server," "Calculator" (Computer), "Telefon" (Phone). These examples reinforce the interpretation of a Node as a standalone computational host.
Visual Implication: While the Core Profile does not explicitly define the shape, it implies the standard UML representation of a 3-dimensional cuboid, which is universally recognized as the symbol for a Node.
2.1.2. The Passive Peripheral (Device)
The second mandatory entity is the Device (referenced as "Device" or "Dispozitiv" in the source).
Functional Definition: A Device is strictly defined as peripheral equipment that DOES NOT PROCESS data (NU PRELUCREAZĂ date). This effectively creates a class of "dumb" hardware—Input/Output peripherals that serve the Processing Nodes. This distinction is crucial for the DSL's type system; a Device cannot theoretically host an Artifact (software) because it lacks processing capability, a constraint that the DSL semantic validator must flag as a warning.
Stereotype Requirement: The Core Profile imposes a mandatory syntactic marker: the entity must carry the stereotype «device». This is not an optional attribute but a defining characteristic. In standard UML, a Device is a subclass of Node , but here it is treated almost as a distinct ontological category defined by its passivity.
Mandatory Naming Convention: Like the Node, the Device name must inherently be a Noun.
Exemplars: The guide lists "Mouse," "Imprimanta" (Printer), "Tastatura" (Keyboard), and "Scaner" (Scanner). These examples confirm the peripheral nature of the entity.
2.2. Mandatory Relational Syntax and Topology
The Core Profile introduces a highly restrictive rule regarding connectivity, which significantly simplifies the complex graph of standard UML relationships.
The Association: The only permissible relationship type explicitly mentioned is the Association.
Topology Constraint: The text states: "The Association is always used to connect only Nodes" (Asocierea - întotdeauna se folosește pentru a conecta doar Nodurile).
Critical Analysis of the Constraint: This rule introduces a logical paradox when viewed against the definition of a Device. If a Device (e.g., a Printer) is ontologically distinct from a Node (e.g., a Server), and Associations connect only Nodes, then a Printer cannot typically be connected to a Server in this strict model. However, standard diagrams invariably show peripherals connected to computers.
Resolution strategy for the DSL: The DSL must treat Device logically as a specialized subtype of Node (inheriting the Connectable interface) to allow connectivity, thereby satisfying the visual requirement while strictly validating the attribute constraints (Processing vs. Non-Processing). The generated diagram will visually depict an association line, but the underlying validator will ensure that the connection is semantically valid within the "Node-to-Node" or "Node-to-Peripheral" context, implicitly categorizing the Peripheral as a leaf-node in the graph.

3. The UML Specification Expansion: Filling the Architectural Gaps
While the Core Profile provides a solid pedagogical foundation, it is effectively a "strict subset" that lacks the semantic density required for industrial-strength architecture documentation. To build a robust text-to-diagram tool comparable to PlantUML or Mermaid , we must expand the core definitions using the OMG UML 2.5.1 Specification. This expansion introduces standard attributes (visibility, multiplicity), advanced entities (artifacts, execution environments), and complex relationships (dependency, deployment) that are implied by the physical reality of software deployment but absent from the simplified guide.
3.1. Structural Attribute Expansion
The Core Profile defines the existence of "Node" and "Device" but fails to specify their internal properties or how they are parameterized. The UML 2.5.1 metamodel defines Node as a DeploymentTarget, which inherits from Classifier. This inheritance hierarchy unlocks a suite of standard attributes that the DSL must support to be compliant with the broader UML standard.
3.1.1. Visibility and Scope Modifiers
In the UML specification, classifiers possess visibility attributes that define their accessibility within the model namespace. For deployment diagrams, this is critical for distinguishing between public (internet-facing) infrastructure and private (intranet/DMZ) resources.
Public (+): The node is visible to all elements in the system. Use case: A Public Load Balancer.
Private (-): The node is visible only within its containing namespace (e.g., a database server nested inside a private subnet).
Protected (#): Visible to elements that have a generalization relationship.
Package (~): Visible to elements within the same package or cloud region.
DSL Implementation: The DSL will support standard prefixes (+, -, #, ~) before the identifier name to define these scopes explicitly.
3.1.2. Multiplicity and Cardinality
Physical infrastructure is rarely singular. A diagram symbol labeled "Web Server" often represents a cluster of identical machines. The Core Profile treats nodes as singular instances, but UML 2.5.1 explicitly supports Multiplicity on Nodes.
Requirement: The DSL must allow users to define cardinality constraints (e.g., 1..* for an auto-scaling group, 2 for a redundant pair).
Visual Representation: This attribute is rendered as a text label (e.g., [1..*]) in the top-right corner of the Node symbol. This adds vital capacity planning data to the diagram.
3.1.3. Execution Environments («executionEnvironment»)
The Core Profile distinguishes hardware (Processing vs. Non-processing) but ignores the software layer doing the processing. UML 2.5.1 defines the ExecutionEnvironment as a specialized Node that offers an execution environment for specific types of components.
Definition: These are logical nodes nested within physical nodes, representing operating systems (<<OS>>), containers (<<Docker>>), or runtime environments (<<JVM>>, <<CLR>>).
Necessity: A modern deployment diagram is incomplete without this. A "Server" (Node) hosting a "Web Application" (Artifact) implicitly requires an "Application Server" (Execution Environment) in between. The DSL must support the environment keyword to nest these logic layers within the physical node.
3.1.4. Artifacts («artifact») and Manifestation
The most significant gap in the Core Profile is the absence of Artifacts. Deployment diagrams exist to show where software lives. UML 2.5.1 uses Artifacts to represent concrete physical entities—files, executables, scripts, archives—that result from the development process.
Deployment Relationship: The link between an Artifact and a Node is defined as a "Deployment".
Manifestation («manifest»): The relationship between an Artifact and the abstract Component it implements is a "Manifestation". An artifact (e.g., user-service.jar) manifests a component (e.g., UserService).
Gap Filling: The DSL must introduce an artifact entity. This allows the user to place file-level objects (e.g., config.xml, app.exe) onto the Processing Nodes defined in the Core Profile.
3.2. Relational Expansion and Metamodel Mapping
The Core Profile's restriction to a simple "Association" is insufficient for describing the nuances of network topologies. Standard UML provides specialized connectors that carry semantic weight regarding the protocol and nature of the connection.
3.2.1. Communication Paths («communicationPath»)
In UML 2.5.1, an association between two Deployment Targets (Nodes) is technically a Communication Path. It is a type of Association that implies an exchange of signals or messages.
Protocol Attributes: Unlike a generic association, a communication path often implies a specific technological medium. The DSL must support labeling these paths with protocols (e.g., <<HTTP>>, <<TCP/IP>>, <<JDBC>>) to provide architectural clarity.
Stereotypes: Standard stereotypes are necessary to define the security or physical nature of the link (e.g., «encrypted», «optical»).
3.2.2. Deployment Dependency (<<deploy>>)
This is the standard mechanism for linking software to hardware in UML 2. When an artifact is not physically nested inside a node symbol (for layout reasons), it is connected via a Dependency relationship labeled with the «deploy» stereotype.
Visual Style: A dashed line with an open arrow pointing from the Artifact to the Node.
Logic: Specifies that the Node hosts, executes, or stores the Artifact. The DSL must support a syntax that allows explicit deployment links (e.g., Artifact..> Node) to handle complex layouts where nesting is not feasible.

4. The DSL Definition: The Code Structure
This section formalizes the Deployment Description Language (DDL). The syntax is designed to be declarative, human-readable, and parseable. It merges the strict naming conventions of the Core Profile (validating "Noun" usage) with the structural richness of UML 2.5.1 (supporting attributes, multiplicity, and complex relationships).
4.1. General Syntax Rules and Lexical Structure
To ensure compatibility with modern developer workflows (similar to PlantUML or Mermaid), the DSL adopts a C-style block structure with flexible formatting.
Case Sensitivity: Keywords (e.g., node, device) are case-insensitive to lower the entry barrier for students. Identifiers (e.g., WebServer, Printer_01) are case-sensitive to preserve architectural specificity.
Scope and Nesting: Curly braces {... } are used to define scope, representing physical containment (e.g., a Server containing an OS).
Comments: Standard code commenting styles are supported: // for single-line comments and /*... */ for multi-line blocks.
Directives: Directives starting with # or @ (e.g., @layout) control the rendering engine parameters.
4.2. Entity Definitions
The following entities constitute the vocabulary of the DSL. Each entity is defined by its keyword, visual rendering rules, properties, and connection logic.
Entity: Processing Node
Context: The primary active element, strictly compliant with the Core Profile's "Node".
DSL Keyword: node
Core Constraint Enforcement: The parser includes a heuristic check to validate that the identifier is a Noun. If a verb is detected (e.g., "Calculating"), a warning is emitted: "Violation of Core Profile: Node name must be a Noun."
Visual Style:
Shape: 3-dimensional Cuboid (Standard UML Node).
Border: Solid, black, 1px width.
Color: Default white or light grey background; distinct from Devices.
Properties:
name: String (Mandatory, Unique Identifier).
stereotype: String (Optional, e.g., <<server>>, <<pc>> ). If omitted, defaults to generic Node.
visibility: Enum (+, -, #, ~) displayed as a prefix.
multiplicity: String (e.g., 1..*) displayed in the top-right corner.
tags: Dictionary of Key-Value pairs (e.g., OS="Ubuntu", CPU="4 core") displayed in a properties compartment.
Syntax Example:
node WebServer [1..*] {
stereotype: "computer"
visibility: public
tags {
OS = "Ubuntu 20.04"
Role = "Primary"
}
}
Entity: Peripheral Device
Context: The passive element, strictly compliant with the Core Profile's "Device".
DSL Keyword: device
Core Constraint Enforcement: The parser automatically applies the «device» stereotype to any entity declared with this keyword, ensuring strict adherence to the Teacher's Core without requiring manual user input.
Visual Style:
Shape: 3-dimensional Cuboid.
Label: Must explicitly display «device» above the name.
Color: Differentiated from Nodes (e.g., light blue) to visually signal the "Non-Processing" status.
Properties:
name: String (Mandatory, Noun).
vendor: String (Optional).
location: String (e.g., "Room 101").
Syntax Example:
device LaserPrinter {
// "stereotype: device" is implicit and immutable
location: "Office Floor 2"
}
Entity: Artifact (UML Spec Gap Filler)
Context: Represents the physical files (software) processed by Nodes. Essential for mapping software to hardware.
DSL Keyword: artifact
Visual Style:
Shape: Rectangle with the standard UML "document" icon (dog-eared corner) in the top-right or the keyword «artifact».
Properties:
name: String (e.g., user-service.jar).
version: String.
manifests: List of Component names (e.g., manifests:).
Syntax Example:
artifact UserDbSchema {
version: "1.2.0"
stereotype: "file"
}
Entity: Execution Environment (UML Spec Gap Filler)
Context: Represents the software layer (OS, Container, Database System) hosting artifacts.
DSL Keyword: environment or executionEnv
Visual Style:
Shape: Nested 3D Node or 2D Rectangle within a Node.
Label: Must display «executionEnvironment» or specific stereotypes like «OS».
Syntax Example:
node AppServer {
environment JVM_Container {
stereotype: "J2EE Server"
version: "17"
}
}
4.3. Connection Definitions and Grammar
The DSL distinguishes between the generic "Association" mandated by the Core Profile and the specialized paths defined by UML 2.5.1.
Connection: Association
Context: The standard structural link defined in the Core Profile.
DSL Symbol: --- (Bi-directional) or --> (Uni-directional).
Line Style: Solid Line.
Arrow Head: None (for ---) or Open Arrow (for -->).
Logic: Represents a physical or logical connection between Nodes.
Constraint Check: The validator issues a warning if an Association connects an Artifact to a Node directly, suggesting a Deployment relationship instead.
Syntax: NodeA -- NodeB
Connection: Communication Path
Context: A specialized Association for network traffic, carrying protocol information.
DSL Symbol: <--> or --> with a protocol label.
Line Style: Solid Line.
Logic: Represents a medium for exchanging signals/messages (e.g., Ethernet, HTTP).
Properties: protocol (Label displayed on the line).
Syntax: WebServer -- DatabaseServer : <<TCP/IP>>
Connection: Deployment
Context: The dependency of an artifact on a node.
DSL Symbol: ..> (Dotted line with arrow).
Line Style: Dashed/Dotted Line.
Arrow Head: Open Arrow.
Label: Automatically labeled «deploy».
Logic: Artifact..> Node implies the Artifact resides on the Node.
Syntax: UserService.jar..> AppServer
Connection: Manifestation
Context: The abstraction link between an Artifact and the Component it represents.
DSL Symbol: ..|> (Dotted line with triangular head).
Label: «manifest».
Logic: Artifact..|> Component.
4.4. Comprehensive Code Structure Example
The following example demonstrates the synthesis of the Core Profile (Strict Nodes/Devices) with UML Expansion attributes (Execution Environments, Artifacts, Protocols).
// DSL Specification Version 1.0
// Define a Core Profile Processing Node with UML Multiplicity
node MainServer [1..*] {
stereotype: "computer"
visibility: +
tags {
OS = "Ubuntu 20.04"
Role = "Primary"
RAM = "64GB"
}
// UML Expansion: Nested Execution Environment
environment DockerEngine {
    stereotype: "containerHost"
    
    // UML Expansion: Artifact Deployment via nesting (Implicit Deployment)
    artifact "PaymentService.jar" {
        version: "v2.3"
    }
}

}
// Define a Core Profile Non-Processing Device
device NetworkPrinter {
// Stereotype <> is auto-applied by the 'device' keyword
location = "Office Floor 2"
vendor = "HP"
}
// Define Core Profile Association
// "Always used to connect only Nodes" - strictly followed here
MainServer -- NetworkPrinter : "Print Jobs"
// External Node for context
node DatabaseCluster {
stereotype: "database"
}
// Detailed Communication Path (UML Spec Expansion)
// Using label to specify protocol
MainServer -- DatabaseCluster : <<JDBC/SSL>>

5. Edge Cases & Layout Management Strategy
To ensure the DSL is robust enough for implementation in software tools, we must define behaviors for edge cases, nesting complexities, and layout algorithms. This section addresses the technical implementation details that often cause DSLs to fail in complex scenarios.
5.1. Handling Deep Nesting (Composition)
The UML 2.5.1 specification relies heavily on nesting to represent DeploymentTarget composition.
Recursive Nesting Rule: A node can contain other nodes, environments, or artifacts. The parser must support infinite recursion depth for brackets {... }.
Visual Rendering Strategy: Nested elements must be drawn strictly inside the boundary of the parent element. The layout engine (e.g., ELK or Graphviz) must calculate the parent's bounding box dynamically based on the size and position of its children.
Edge Case - The "Smart" Device: If a user nests an artifact (software) inside a device (defined as non-processing), a logical conflict arises.
Validation Logic: The parser should emit a Semantic Warning: "Non-processing Device contains executable Artifact. This violates the Core Profile definition."
Permissive Rendering: Despite the warning, the tool should render the nesting to allow for real-world edge cases (e.g., a Printer containing "Firmware").
5.2. Labeling and Stereotype Conflicts
Conflict: The Core Profile mandates the <<device>> stereotype for peripherals. A user might manually attempt to override this, e.g., device Server <<server>>.
Resolution Strategy: The DSL Keyword (device) is the master authority.
Rule: The device keyword forcibly injects the <<device>> stereotype.
Multiple Stereotypes: UML 2.5.1 allows multiple stereotypes. The renderer should display both: <<device, server>>. This respects the Core Profile while allowing user flexibility.
5.3. Communication Path Multiplexing
Scenario: Two nodes are connected via multiple protocols (e.g., HTTP, SSH, and FTP simultaneously).
Layout Challenge: Drawing three separate lines creates visual clutter and edge routing collisions.
Solution: The DSL supports Comma-Separated Protocols on a single link entity.
Syntax: ServerA -- ServerB : "HTTP, SSH, FTP"
Rendering: A single solid line with a multi-line label.
5.4. Ambiguous Connectivity and Auto-Correction
Scenario: A user connects an Artifact to a Node using the standard association syntax -- instead of the deployment syntax ..>.
Rule: The Core Profile states "Associations connect only Nodes." Standard UML implies structural associations between software and hardware are rare (usually Dependency).
Auto-Correction Resolution: The DSL compiler should implement an Auto-Correction Layer. If SourceType == Artifact and TargetType == Node, the compiler automatically converts the generic -- token into a Dependency (..>) relationship, maintaining strict UML compliance even if the user is imprecise.
5.5. Layout Directives and Grouping
To compete with tools like PlantUML , the DSL requires explicit layout hints to manage diagram density.
Directionality: The DSL supports global directives @direction: left-to-right or @direction: top-to-bottom to optimize the graph layout algorithm (e.g., Sugiyama algorithm).
Grouping Containers: The cloud and package keywords are introduced as visual containers. These are standard UML elements that do not imply specific hardware but serve as boundaries (e.g., "AWS Cloud" or "DMZ").
Syntax: cloud "AWS" { node... }

6. Comprehensive Attribute and Mapping Table
The following table synthesizes the attributes derived from the Core Profile, UML 2.5.1 Specification, and best practices in Tooling. This serves as the definitive reference for the DSL's symbol table implementation.
Attribute / Element
Core Profile Constraint (Teacher)
UML 2.5.1 Spec (Expansion)
DSL Implementation Strategy
Visual Rendering
Node
Mandatory. Must be "Processing". Name must be Noun.
A DeploymentTarget. Can be nested. Inherits Classifier.
Keyword node. Validates Noun. Supports nesting.
3D Cuboid. White/Grey.
Device
Mandatory. Non-Processing. Stereotype <<device>> required.
A subclass of Node. Physical resource.
Keyword device. Auto-applies stereotype.
3D Cuboid. Distinct Color (Blue).
Execution Env
Missing
Subclass of Node. Software container (OS, DB, Container).
Keyword environment. Nested in Nodes.
Nested Rectangle or Cuboid.
Artifact
Missing
Physical file/software. Manifests components.
Keyword artifact. Deploys to Nodes.
Document Icon / Rectangle.
Association
Mandatory. Connects Nodes only.
Structural relationship.
Keyword --.
Solid line.
Comm. Path
Missing
Association with protocol/message exchange logic.
Association with : "Label" or <<Stereotype>>.
Solid line with Label.
Deployment
Missing
Dependency <<deploy>>. Maps Artifact to Node.
Keyword ..>.
Dashed line, Open Arrow.
Multiplicity
Missing
[1..*], [0..1], etc.
Bracket notation [n..m] after name.
Text in top-right corner.
Visibility
Missing
+ (Pub), - (Priv), # (Prot), ~ (Pkg).
Prefix symbols on identifier names.
Symbol prefixing name.
Tags
Missing
Tagged Values {OS=Linux}.
Block property tags { key=val }.
Properties compartment.


7. Conclusion
This specification provides a rigid yet extensible foundation for a Deployment Diagram DSL. By rigorously enforcing the "Core Profile" rules—specifically the strict ontological distinction between Processing Nodes and Non-Processing Devices—the language satisfies the specific educational constraints provided in the Course Guide. Simultaneously, by layering the UML 2.5.1 specification on top—introducing Artifacts, Execution Environments, and standard attributes like Multiplicity—the language becomes capable of modeling complex, real-world architectures.
The proposed DSL syntax is designed to be "correct by construction," using keyword-driven stereotype injection (device keyword) and heuristic name validation ("Noun" check) to guide the user toward the constraints. Implementation of this DSL should prioritize a parser that validates strict connectivity rules for Associations, while offering "Standard Mode" features (like Artifact deployment and Communication Paths) as advanced functionality to support professional software engineering workflows. The result is a tool that is simple enough for the classroom but powerful enough for the cloud.

Sources:
: uploaded:Regulile sintaxei Diagrama Desfășurărilor.pdf (Primary Constraints)
: uploaded:AMS_Partea_I_RO.doc (General context)
: OMG UML 2.5.1 Specification (Secondary Source)
: PlantUML Documentation (Complementary Source)
: Mermaid.js Documentation (Complementary Source)
: Sparx Systems UML Tutorials (Complementary Source)
: IBM Rational UML Documentation (Complementary Source)
