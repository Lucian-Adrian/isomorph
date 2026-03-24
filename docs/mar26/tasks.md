## Tasks

# 1. Improving DSL for diagrams
What feels missing from the DSL
Diagram-specific syntax is too shallow

The parser body accepts only these major categories: packageDecl, entityDecl, relationDecl, noteDecl, styleDecl, and layoutAnnotation. That is a solid core, but it is not enough for rich UML behavior diagrams.

What I expected

A DSL with first-class diagram statements such as:

title
legend
group
fragment
alt / else / end
loop
opt
par
critical
ref
activate / deactivate
create / destroy
return
guard
entry / exit / do
partition / swimlane
port
artifact
deployment
numbered collaboration messages
What seems present instead

Mostly:

entity declarations
relation declarations
package nesting
notes/styles/layout annotations

That is enough for structure diagrams, but not enough for mature behavioral DSLs.

the sequence spec explicitly discusses:

alt ... else ... end
loop
opt
autonumber
strict_mode
richer participant types like boundary, control, entity, participant

But the current sequence syntax that actually parses is much simpler. Your editor errors with title and alt, and the parser body model does not show dedicated fragment statements.

same pattern appears in other docs too:

state doc discusses composite/nested states and fork/join semantics
activity doc discusses partitions, decision blocks, guards, and swimlane behavior
collaboration doc discusses numbered messages attached to links and self-links
deployment doc discusses artifacts nested in nodes
component doc discusses interfaces, ports, provided/required semantics, and realizations constrained to interface targets

But the implementation surface still looks closer to a generic text-to-diagram engine than a mature UML metamodel
There is not yet a strong “statement layer”

A great DSL usually has 3 layers:

declarations — entities
relations — edges
behavior/layout/config statements — fragments, numbering, guards, scopes, render hints, titles, themes, sections

Isomorph already has 1 and 2, and some of 3 via notes/styles/layout. What is missing is a real statement layer for each diagram family.

A. Sequence diagrams

This is where the gap is most obvious.

Expected but missing / underexposed
title
alt / else / end
opt
loop
par
break
critical
ref
activation bars
explicit return messages
creation/destruction events
autonumbering
guards/conditions as first-class syntax
notes over participants or messages
participant aliases and richer stereotypes
fragments as nested scopes

The sequence spec itself describes several of these, including alt, loop, opt, autonumber, and richer participant kinds.

Priority

Highest priority. Sequence DSLs are judged harshly by users because Mermaid and PlantUML already set expectations.

B. Class diagrams

Class diagrams look like the strongest implemented area. The shipped example is the most substantial, and the grammar clearly supports classes, interfaces, enums, modifiers, methods, fields, inheritance, implementation, stereotypes, relations, and layout anchors.

Still missing / desirable
generics rendered more richly
nested packages with real container behavior
abstract/final visual distinctions beyond text
association classes
qualified associations
constraints
visibility and modifier styling polish
multiplicity syntax as structured fields, not just loose attributes
composition/aggregation rendering refinement
notes attached to members, not only entities
better layout for large hierarchies

The roadmap itself calls out package improvements as a high-priority need, which reinforces this.

Priority

Medium-high. This is already usable, so improvements here will pay off fast.

C. Use case diagrams

The shipped example supports actors, usecases, associations, and include/extend via labels on arrows.

Missing / expected
real first-class include and extend operators instead of relation labels
system boundary / subject container as first-class syntax
actor generalization
use-case generalization
extension points
abstract use cases
proper stereotype rendering for include/extend
layout helpers for actor-to-subject placement

The doc also discusses boundary/system containers and richer semantics.

Priority

Medium. Very feasible to close.

D. Component diagrams

The example supports component, node, packages, and simple relations.

Expected but missing
ports
provided/required interfaces
lollipop/socket notation
explicit interface constructs in component diagrams
realization constraints
nested component structure
assembly connectors and delegation connectors
component instances vs types
dependency stereotypes
configuration-level semantics

The component spec explicitly discusses interfaces, port wiring, and provided/required semantics.

Priority

High. This is one of the most valuable differentiators for architecture modeling.

E. State diagrams

The docs expect far more than a flat node-edge graph:

state
composite/nested states
concurrent/orthogonal regions
fork/join
choice/history pseudostates
entry, exit, do
guards and transition labels
initial/final states
notes on states/transitions
Missing / likely underimplemented

Given the generic parser shape, these appear underexposed as syntax-level constructs today.

Priority

Medium-high. State diagrams need true nesting and pseudostates to feel real.

F. Activity / flow diagrams

The parser and README mention flow, and the docs describe activity semantics such as partitions, start/stop, decisions, merges, fork/join, and strict guard behavior.

Missing / expected
swimlanes / partitions as first-class containers
decision guards as structured syntax
merge blocks
loop/back-edge control
action annotations
object flows vs control flows
start/stop cardinality validation surfaced to users
auto-routing across lanes
Priority

High. Activity diagrams become messy fast without layout intelligence.

G. Collaboration / communication diagrams

The collaboration doc is conceptually richer than the current visible surface. It talks about:

non-directional links carrying directional messages
numbered messages
self-links
message signatures attached to links
Missing / expected
explicit message numbering syntax
message nesting and sub-numbering (1, 1.1, 1.2)
self-link message rendering
return messages
ordering validation
auto-placement of message labels around graph edges
Priority

Medium-high.

H. Deployment diagrams

The README lists deployment diagrams as supported, but also says the renderer is “To Be Extracted.”

The deployment doc expects nodes, environments, devices, and artifacts, including nested artifacts.

Missing / expected
proper node/device/environment hierarchy
artifacts as first-class nested entities
deployment relations distinct from generic edges
execution environment notation
network/protocol labels
infrastructure icons / visual grammar
containerized deployment semantics
Priority

High, because deployment is currently the least convincing as “supported.”

would add
aliases: participant AuthService as Auth
multiline note blocks
relation sugar: include, extend, depends, realizes
grouped sections
trailing commas where useful
doc comments
imports that actually matter
macros / reusable snippets
presets / templates per diagram
# 2 
1. Titles, legends, and top-level config

You immediately hit this with title. That should exist. A real DSL needs:

title
subtitle
caption
legend
theme
strict
autolayout
direction
scale

Right now this feels absent or inconsistent.

2. Diagram-specific semantic validation

The README highlights semantic checks, which is excellent. But the next leap is diagram-native validation, not just generic symbol-table correctness.

Examples:

sequence: fragment balance, activation lifetimes, return ordering
activity: exactly one start, guard completeness, partition crossing validity
state: unreachable states, illegal pseudostate transitions
component: realization target must be interface
deployment: artifact must live on node/device/environment
use case: include/extend direction correctness

Some of these are described in docs, but they need to become first-class enforced behavior.

3. Better syntax ergonomics

The language is formal, but not yet ergonomic enough.

I would add
aliases: participant AuthService as Auth
multiline note blocks
relation sugar: include, extend, depends, realizes
grouped sections
trailing commas where useful
doc comments
imports that actually matter
macros / reusable snippets
presets / templates per diagram
4. Better layout model

The bidirectional anchor model is very strong. That is one of the best ideas in the repo.

But today it still needs:

partial auto-layout
lock/unlock entity positions
container-aware nesting
routing hints
alignment tools
distribution tools
snap-to-grid controls
lane/package auto-resize
edge routing modes

The roadmap mentions auto-layout improvements, but I would move that much higher.

5. Better parity between docs, grammar, parser, renderer, and examples

This is the most practical engineering issue.

Right now there is a mismatch between:

what README claims is supported
what docs describe
what parser accepts
what renderer likely draws
what examples demonstrate

That mismatch creates user frustration faster than missing features do.

Crisp list of missing features I expected
Global
title/subtitle/caption
legend
diagram config flags
aliases
reusable macros/templates
richer imports/modules
stronger autolayout controls
better docs/impl parity
Sequence
alt/else/end
loop/opt/par
activation bars
returns
create/destroy
notes
autonumber
fragment nesting
Class
better packages
association classes
constraints
richer multiplicities
better generic rendering
Use case
first-class include/extend
system boundary
extension points
actor/use-case generalization
Component
interfaces
ports
provided/required notation
delegation/assembly connectors
nested internals
State
composite states
regions
entry/exit/do
pseudostates
transition guards
Activity
partitions/swimlanes
strict decision syntax
object/control flow distinction
loop/back-edge handling
Collaboration
numbered messages
message nesting
self-links
direction markers on nondirectional links
Deployment
artifacts
environment/device/node hierarchy
deployment semantics
infra-aware rendering   