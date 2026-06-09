# Isomorph Animation & Export Feature: Technical Documentation

## Overview
The Isomorph Animation feature brings static diagrams to life by using motion to explain the underlying logic, flow, and purpose of the diagram. This feature allows users to visualize data paths, logic splits, and state changes, and then export these animations as shareable GIF files.

## User Interface & Playback
To give users full control over the visual flow, the toolbar includes dedicated animation controls:
* Play Button: Triggers the animation sequence specific to the current diagram type.
* Stop Button: Halts the animation immediately, clears any moving elements, and resets the diagram to its default static state.

## Animation Behaviors by Diagram Type

### 1. Sequence Diagrams (Time-Ordered Flow)
* The Light Trail: A glowing object—such as a star, a ray of light, or a luminescent blob—travels along the message lines. It begins at the initial lifeline and follows the exact sequential order of the calls and returns down the Y-axis, illuminating the flow of communication from start to finish.

### 2. Communication Diagrams (Object Interaction)
* The Simultaneous Ping: Because strict linear time isn't the primary focus here, connections pulse or "ping" with small flashes of light between the connected nodes. This highlights the web of relationships and the volume of messages passed between objects.

### 3. Activity Diagrams (Swimlane Workflows)
* The Baton Pass: A glowing token moves through the workflow nodes. When the flow crosses a swimlane boundary (signifying handing off a task to another department or actor), the token flashes or changes color slightly to emphasize the transfer of responsibility.

### 4. Flowcharts (Logic & Decisions)
* The Split Pulse: A glowing orb travels down the lines. When it hits a decision diamond, the orb splits into two smaller orbs (e.g., green for "Yes" and red for "No") that briefly travel down their respective paths to show potential outcomes.
* The Fill-Up: Connection lines progressively "fill" with a solid color, like water flowing through pipes, filling up each process box step-by-step.

### 5. Architecture & Network Diagrams (Infrastructure)
* Data Packets: Small, dashed bursts of light travel continuously back and forth along the connection lines between infrastructure nodes (like servers and databases).
* Marching Ants: Connection lines are dashed and slowly animate to look like they are moving in the direction of the data flow, creating a hum of background activity.

### 6. State Machine Diagrams (States & Transitions)
* The Breathing Node: The currently active state has a soft, glowing drop-shadow that slowly pulses or "breathes."
* The Leap: During a transition, a spark jumps from the current state along the curved arrow to the next state, illuminating the transition label as it passes.

### 7. Class & Entity-Relationship Diagrams (Structure)
* The Blueprint Reveal: Because these diagrams show static structure, the animation focuses on creation. The central core class/entity appears first, and relationships "shoot out" from it, drawing the connecting lines and popping related classes into existence one by one.

## GIF Export Implementation
To allow users to save and share these animated workflows outside of Isomorph, the tool includes a GIF export engine using canvas-based frame capturing.

1. Trigger: The user selects "Export as GIF".
2. Capture: Using a browser-side library (like gif.js or ccapture.js), Isomorph triggers the "Play" action in the background.
3. Frame Generation: As the animation runs, the system takes snapshots of the HTML5 <canvas> (or rendered SVG) at a fixed frame rate (e.g., 30 frames per second).
4. Compilation: The snapshots are bundled into a .gif format using web workers to prevent the UI from freezing during generation.
5. Download: Once compiled, the user is prompted to download the final animated GIF file to their local machine.
