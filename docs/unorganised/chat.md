## Bugs (What Doesn't Work)

- **Arrows pointing under figures**: "[24/03/2026 22:16] Aurel: Eu știu de un bug - toate săgețile se duc sub figuri [24/03/2026 22:16] Aurel: In afara de class" – Arrows go under figures except for class diagrams. "To see it live - if you drag smth and don't drop it, you can see that all the relations point to it's center underneath it, not like in classes where it points to the margins"

- **Ports/interfaces interconnection**: "[24/03/2026 22:18] Aurel: Avem ports/interfaces [24/03/2026 22:18] Aurel: Dar trebuie activat din modal [24/03/2026 22:18] Aurel: Și nu se interconectează între ele ca pe EA Asta trebuie de retușat" – Ports/interfaces exist but need to be activated from modal, and they don't interconnect properly like in EA.

- **Deployment diagrams**: "[24/03/2026 22:19] Aurel: Deployment n-am înțeles ce anume nu are" and "Also for deployment We can't really have a node inside a node, it is badly done, so needs fixing" – Issues with nodes inside nodes.

- **System boundaries in use case diagrams**: "[24/03/2026 22:21] Aurel: We have system boundaries in use case diagrams [24/03/2026 22:22] Aurel: Rename-able too But it is a bit bugged in the example one if you drag a new one cause it does not track the position of pre-rendered one After you drag a new one it works" – Bug when dragging new ones, doesn't track position of pre-rendered.

- **Sequence fragments**: "[24/03/2026 22:19] Aurel: Sequence fragments - tbh I forgot about them" – Not implemented.

- **Overall codebase**: "[24/03/2026 22:11] Lucian: turns out our codebase is a huge mess [24/03/2026 22:11] Lucian: like almost nothing works" "[24/03/2026 22:15] Aurel: Sunt o grămadă de slop functions scattered throughout the code Gemini loves to make them Overrides and stuff I wanted to clean them up after merging the translations" – General mess, basic functionality broken.

## Features (What Works)

- **Swimlanes**: "[24/03/2026 22:17] Aurel: Swimlanes sunt Eu le-am adăugat duminică odată cu dark mode [24/03/2026 22:17] Aurel: Și am mai adăugat coordonate width and height for them" – Added with dark mode, includes width and height coordinates.

- **Custom sizes for entities**: "[24/03/2026 22:18] Aurel: Am modificatul parserul să poată citi 4 coordonate Eventual să avem custom sizes for all entities" – Parser modified to read 4 coordinates for custom sizes.

- **Ports/interfaces**: "[24/03/2026 22:18] Aurel: Avem ports/interfaces" – Exist, though activation and interconnection need fixing.

- **System boundaries in use case**: "[24/03/2026 22:21] Aurel: We have system boundaries in use case diagrams [24/03/2026 22:22] Aurel: Rename-able too" – Have them, rename-able.

- **Sequence custom y coordinates**: "[24/03/2026 22:27] Aurel: Also on Sunday I added at sequence custom y coordinates for relations" – Added for relations.

- **Numbered messages**: "[24/03/2026 22:28] Aurel: Also also 8. We do have numbered messages [24/03/2026 22:28] Aurel: I added them on Saturday when I added the transform tool from sequence to collaboration [24/03/2026 22:29] Aurel: Just I did not check if all the arrow types show up But it worked nicely" – Added, with transform tool.

- **Auto-layout**: "[24/03/2026 22:29] Aurel: And one important thing from my roadmap that is actually important now - better auto-layout" – Important feature, needs improvement.

Pinch canvas for zooming on mobile view 

partitions are bugged, they try to auto resize themselves based on the activity diagram but they fail miserably + it throws SS-10 error - (SS—IO) Layout annotation references unknown entity or package 'Partitionl'

when i move on y axis a message in sequence diagram, the code formatting gets messed and removes the newline between relations and coordinates

circle notation/ lolipop notation for component diagram needs to be addded (maybe in a modal a checkbox for "use circle notation for components" or smth)