## The Recursive Agent Execution Blueprint

To safely automate this with an agent (whether you are scripting it via an API or using an advanced tool like Aider or Cursor), you must execute a strict, multi-step pipeline.

```
[6000-line App.tsx] 
       │
       ▼
 1. PARSE AST ───────> Generate Dependency JSON Map (No Code Changes)
       │
       ▼
 2. ISOLATE LEAFS ───> Extract Bottom-Level UI Leaf Components
       │
       ▼
 3. HOOK EXTRACTION ─> Extract Supabase State & Logic Chains
       │
       ▼
 4. RE-ORCHESTRATE ──> Re-write App.tsx as a Pure Orchestrator

```

### Step 1: The Metadata/AST Phase (Read-Only)

Lock the agent's write capabilities. Pass the file and give it one task: **Map, do not touch.**

* **The Prompt:** *"Analyze this `App.tsx` file. Do not write any refactored components. Instead, output a structured JSON map of every interface, every pure utility function, every custom piece of state, and every sub-UI section. For each item, list its direct line range and its variable dependencies."*
* **The Goal:** You now have a strict blueprint of the file's dependency graph that fits entirely into a small context window.

### Step 2: Leaf Node Extraction (Bottom-Up)

Use the JSON map to feed the agent *only* the specific chunk of code for isolated components.

* **The Prompt:** *"Here is lines 4200 to 4500 from `App.tsx` representing the `Toolbar` UI. It depends on these 3 variables: `currentView`, `setView`, `isLoading`. Extract this into a standalone, fully typed TypeScript component named `components/Toolbar.tsx`. Do not touch any other code."*
* **The Goal:** The agent is operating inside a hyper-focused context window of under 500 tokens. It can generate perfect, professional TypeScript without hallucinating.

### Step 3: Custom Hook Isolation (Logic vs. View)

Once the UI is cleared out, pass the remaining state logic blocks to the agent to build your hooks.

* **The Prompt:** *"Here are the 4 `useState` variables and 2 `useEffect` calls handling the Supabase auth state. Extract them into a clean React custom hook called `hooks/useAuth.ts`. Ensure all return values are strictly typed."*

---

The interactive simulator below demonstrates the mathematical relationship between file token size, agent prompt strategies, and context window health, showing why monolithic execution collapses and how recursive pipelining protects token space.

### Implementing this in Real Life

If you want to try this without writing a custom Python automation script, use an agentic tool like **Aider** or **Cursor’s Agent Mode (Composer)**, but force the modularity yourself through your commands:

1. **Do not tell it to refactor the file.** 2. Say: *"Identify the smallest, lowest-dependency UI block inside `App.tsx`."*
2. Once it identifies it, say: *"Extract exactly that block into its own file in a new `components/` directory, update the imports in `App.tsx`, and stop."*
3. Run your project locally to verify it compiles. Commit the change (`git commit -m "extracted component X"`).
4. Move to the next block.

By forcing the agent to take small, single-responsibility steps with concrete stops and code-compilation checks between every step, you eliminate context window degradation entirely.
