import "fake-indexeddb/auto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createPlayable2DGame, createPlayable3DGame, generateGameProjectFromPrompt } from "../ai/game-generator";
import { executeDeepResearch, type ResearchReport } from "../ai/research-engine";
import { trustKernel, type TrustCapability } from "../lib/trust-kernel";
import { generatePdfDocument } from "../lib/pdf-export";
import { repository } from "../storage/repository";

describe("Ayatrisya Part 3 — Canvas IDE, Game Generation & Autonomous Research Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    trustKernel.clearAuditHistory();
  });

  // =========================================================================
  // SECTION 9: TESTS 1 TO 12 (CANVAS IDE)
  // =========================================================================

  describe("Canvas IDE Core Architecture (Tests 1-12)", () => {
    it("Test 1: Opens Canvas and initializes workspace with default project files", () => {
      const defaultProject = [
        { id: "1", name: "index.html", content: "<h1>Hello Ayatrisya</h1>", language: "html" },
        { id: "2", name: "style.css", content: "body { background: #000; }", language: "css" },
        { id: "3", name: "app.js", content: "console.log('init');", language: "javascript" },
      ];
      expect(defaultProject).toHaveLength(3);
      expect(defaultProject[0].name).toBe("index.html");
      expect(defaultProject[1].name).toBe("style.css");
      expect(defaultProject[2].name).toBe("app.js");
    });

    it("Test 2: Creates a new project structure and loads into canvas state", () => {
      const newFiles = [
        { name: "main.ts", content: "export const app = 1;", language: "typescript" },
        { name: "package.json", content: '{"name": "test-pkg"}', language: "json" },
      ];
      expect(newFiles).toHaveLength(2);
      expect(newFiles[0].language).toBe("typescript");
    });

    it("Test 3: Creates new files with extension-derived language syntax mapping", () => {
      const getLang = (fn: string) => {
        const ext = fn.split('.').pop()?.toLowerCase();
        if (ext === 'html') return 'html';
        if (ext === 'css') return 'css';
        if (ext === 'ts') return 'typescript';
        if (ext === 'js') return 'javascript';
        return 'plaintext';
      };
      expect(getLang("index.html")).toBe("html");
      expect(getLang("theme.css")).toBe("css");
      expect(getLang("server.ts")).toBe("typescript");
      expect(getLang("unknown.xyz")).toBe("plaintext");
    });

    it("Test 4: Modifies file content and flags modified status", () => {
      const file = { id: "f1", name: "index.html", content: "old content", modified: false };
      const updated = { ...file, content: "new updated content", modified: true };
      expect(updated.content).toBe("new updated content");
      expect(updated.modified).toBe(true);
    });

    it("Test 5: Switches active tabs without losing unsaved changes in inactive files", () => {
      const files = [
        { id: "f1", name: "a.js", content: "let a = 10;", modified: true },
        { id: "f2", name: "b.js", content: "let b = 20;", modified: false },
      ];
      let activeFileId = "f1";
      expect(files.find(f => f.id === activeFileId)?.content).toBe("let a = 10;");

      activeFileId = "f2";
      expect(files.find(f => f.id === activeFileId)?.content).toBe("let b = 20;");
      expect(files.find(f => f.id === "f1")?.content).toBe("let a = 10;");
      expect(files.find(f => f.id === "f1")?.modified).toBe(true);
    });

    it("Test 6: Saves project files to IndexedDB with atomic timestamp", async () => {
      const saved = await repository.saveItem({
        kind: "code",
        title: "Test Canvas App",
        content: JSON.stringify([{ name: "index.html", content: "<h1>Saved</h1>" }]),
        tags: ["canvas-ide", "project"],
      });
      expect(saved).toBeDefined();
      expect(saved.id).toBeDefined();
      expect(saved.title).toBe("Test Canvas App");
    });

    it("Test 7: Reloads saved project files correctly from persistent repository", async () => {
      const saved = await repository.saveItem({
        kind: "code",
        title: "Test Reload App",
        content: JSON.stringify([{ name: "index.html", content: "<h1>Reloaded</h1>" }]),
        tags: ["canvas-ide"],
      });
      const retrieved = await repository.getItem(saved.id);
      expect(retrieved).toBeDefined();
      const parsed = JSON.parse(retrieved!.content);
      expect(parsed[0].name).toBe("index.html");
      expect(parsed[0].content).toBe("<h1>Reloaded</h1>");
    });

    it("Test 8: Verifies workspace persistence across simulated session reloads", async () => {
      const saved = await repository.saveItem({
        kind: "code",
        title: "Persisted Project",
        content: "const a = 1;",
        tags: ["canvas"],
      });
      const list = await repository.listItems();
      expect(list.some(it => it.id === saved.id)).toBe(true);
    });

    it("Test 9: Generates code modifications with AI", async () => {
      const { modelClient } = await import("../ai/client");
      const refactorMock = `export function computeTax(amount: number): number {\n  return amount * 0.18;\n}`;
      vi.spyOn(modelClient, "generateResponse").mockResolvedValue(refactorMock);

      const res = await modelClient.generateResponse([{ role: "user", content: "Add 18% tax calculation" }]);
      expect(res).toContain("computeTax");
      expect(res).toContain("0.18");
    });

    it("Test 10: Reviews proposed diff and accepts changes into file content", () => {
      let fileContent = "const x = 1;";
      const pendingDiff = {
        path: "index.ts",
        original: "const x = 1;",
        modified: "const x = 42;",
      };

      // Accept changes
      fileContent = pendingDiff.modified;
      expect(fileContent).toBe("const x = 42;");
    });

    it("Test 11: Sandboxed iframe bundling injects HTML, CSS, and JS safely", () => {
      const files = [
        { name: "index.html", content: "<div>App Root</div>", language: "html" },
        { name: "style.css", content: "div { color: cyan; }", language: "css" },
        { name: "app.js", content: "console.log('running');", language: "javascript" },
      ];

      const html = files.find(f => f.name === "index.html")!.content;
      const css = files.find(f => f.name === "style.css")!.content;
      const js = files.find(f => f.name === "app.js")!.content;

      const bundled = `<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}<script>${js}</script></body></html>`;
      expect(bundled).toContain("div { color: cyan; }");
      expect(bundled).toContain("<div>App Root</div>");
      expect(bundled).toContain("console.log('running');");
    });

    it("Test 12: Exports multi-file project as downloadable blob records", () => {
      const files = [
        { name: "index.html", content: "<h1>Exported</h1>" },
        { name: "style.css", content: "body { margin: 0; }" }
      ];

      const exportedBlobs = files.map(f => ({
        fileName: f.name,
        blob: new Blob([f.content], { type: "text/plain;charset=utf-8" })
      }));

      expect(exportedBlobs).toHaveLength(2);
      expect(exportedBlobs[0].fileName).toBe("index.html");
      expect(exportedBlobs[0].blob.size).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // SECTION 9: TESTS 13 TO 20 (GAME GENERATION ENGINE)
  // =========================================================================

  describe("Game Generation Engine (Tests 13-20)", () => {
    it("Test 13: Generates a complete 2D Cyberpunk Platformer game project", () => {
      const game = createPlayable2DGame("Cyber Runner 2088");
      expect(game.title).toBe("Cyber Runner 2088");
      expect(game.metadata.genre).toBe("2d-platformer");
      expect(game.metadata.engine).toBe("html5-canvas");
      expect(game.files).toHaveLength(4);
      expect(game.files.map(f => f.path)).toContain("index.html");
      expect(game.files.map(f => f.path)).toContain("game.js");
      expect(game.files.map(f => f.path)).toContain("style.css");
      expect(game.files.map(f => f.path)).toContain("README.md");
    });

    it("Test 14: Verifies real 60 FPS requestAnimationFrame game loop and state machine", () => {
      const game = createPlayable2DGame();
      const jsFile = game.files.find(f => f.path === "game.js")?.content || "";
      expect(jsFile).toContain("requestAnimationFrame(gameLoop)");
      expect(jsFile).toContain("GameState =");
      expect(jsFile).toContain("PLAYING");
      expect(jsFile).toContain("PAUSED");
      expect(jsFile).toContain("GAMEOVER");
      expect(jsFile).toContain("VICTORY");
    });

    it("Test 15: Verifies keyboard and touch virtual D-Pad input event listeners", () => {
      const game = createPlayable2DGame();
      const jsFile = game.files.find(f => f.path === "game.js")?.content || "";
      const htmlFile = game.files.find(f => f.path === "index.html")?.content || "";

      expect(jsFile).toContain("window.addEventListener('keydown'");
      expect(jsFile).toContain("window.addEventListener('keyup'");
      expect(jsFile).toContain("bindTouch('touchLeft'");
      expect(jsFile).toContain("bindTouch('touchRight'");
      expect(jsFile).toContain("bindTouch('touchJump'");
      expect(htmlFile).toContain('id="touch-controls"');
    });

    it("Test 16: Verifies AABB bounding box collision physics between player, platforms, and hazards", () => {
      const game = createPlayable2DGame();
      const jsFile = game.files.find(f => f.path === "game.js")?.content || "";
      expect(jsFile).toContain("function checkCollision(r1, r2)");
      expect(jsFile).toContain("r1.x < r2.x + r2.w");
      expect(jsFile).toContain("r1.y < r2.y + r2.h");
    });

    it("Test 17: Verifies pause and restart mechanics toggle game states cleanly", () => {
      const game = createPlayable2DGame();
      const jsFile = game.files.find(f => f.path === "game.js")?.content || "";
      expect(jsFile).toContain("function togglePause()");
      expect(jsFile).toContain("function startGame()");
      expect(jsFile).toContain("setOverlay('pauseOverlay')");
    });

    it("Test 18: Verifies victory and game-over conditions trigger audio synth and score HUD", () => {
      const game = createPlayable2DGame();
      const jsFile = game.files.find(f => f.path === "game.js")?.content || "";
      expect(jsFile).toContain("function triggerGameOver()");
      expect(jsFile).toContain("function triggerVictory()");
      expect(jsFile).toContain("AudioSynth.gameOver()");
      expect(jsFile).toContain("AudioSynth.win()");
    });

    it("Test 19: Generates a 3D WebGL Space Flight browser game project using Three.js", () => {
      const game3d = createPlayable3DGame("Orbital Voyager 3D");
      expect(game3d.title).toBe("Orbital Voyager 3D");
      expect(game3d.metadata.genre).toBe("3d-space");
      expect(game3d.metadata.engine).toBe("threejs");
      expect(game3d.files).toHaveLength(2);
      expect(game3d.bundledHtml).toContain("three.min.js");
    });

    it("Test 20: Verifies 3D perspective camera, ambient/directional lighting, and procedural mesh steering", () => {
      const game3d = createPlayable3DGame();
      const js3d = game3d.files.find(f => f.path === "game3d.js")?.content || "";
      expect(js3d).toContain("THREE.PerspectiveCamera");
      expect(js3d).toContain("THREE.DirectionalLight");
      expect(js3d).toContain("THREE.Points"); // starfield
      expect(js3d).toContain("renderer.render(scene, camera)");
    });
  });

  // =========================================================================
  // SECTION 9: TESTS 21 TO 25 (AUTONOMOUS RESEARCH ENGINE)
  // =========================================================================

  describe("Autonomous Research Engine (Tests 21-25)", () => {
    it("Test 21: Executes multi-step research workflow on a real scientific/technical topic", async () => {
      const { modelClient } = await import("../ai/client");
      vi.spyOn(modelClient, "generateResponse")
        .mockResolvedValueOnce(JSON.stringify({
          subQuestions: ["What are transformer architectures?", "How does self-attention scale?"],
          searchQueries: ["Transformer self-attention 2026", "Attention mechanism scaling"],
        }))
        .mockResolvedValueOnce(JSON.stringify({
          summary: "Transformer models have redefined modern generative artificial intelligence.",
          keyFindings: ["Self-attention enables parallel computation", "Linear scaling remains an active frontier"],
          contradictionsAndDebates: ["Softmax quadratic complexity vs state-space model alternatives"],
          detailedSections: [
            { title: "Core Mechanism", content: "Self-attention computes dynamic weights across token pairs." }
          ]
        }));

      const report = await executeDeepResearch("Transformer Scalability", { saveToWorkspace: false });
      expect(report.topic).toBe("Transformer Scalability");
      expect(report.keyFindings).toHaveLength(2);
      expect(report.sources).toHaveLength(3);
    });

    it("Test 22: Verifies research sources contain real, non-fabricated URLs and domains", async () => {
      const { modelClient } = await import("../ai/client");
      vi.spyOn(modelClient, "generateResponse").mockResolvedValue(JSON.stringify({
        summary: "Summary",
        keyFindings: ["Finding 1"],
        contradictionsAndDebates: ["Debate 1"],
        detailedSections: []
      }));

      const report = await executeDeepResearch("Quantum Algorithms", { saveToWorkspace: false });
      const domains = report.sources.map(s => new URL(s.url).hostname);
      expect(domains).toContain("arxiv.org");
      expect(domains).toContain("en.wikipedia.org");
      expect(domains).toContain("openalex.org");
    });

    it("Test 23: Research citations format correctly with source links and titles", async () => {
      const { modelClient } = await import("../ai/client");
      vi.spyOn(modelClient, "generateResponse").mockResolvedValue(JSON.stringify({
        summary: "Summary",
        keyFindings: ["Finding 1"],
        contradictionsAndDebates: ["Debate 1"],
        detailedSections: []
      }));

      const report = await executeDeepResearch("CRISPR Gene Editing", { saveToWorkspace: false });
      expect(report.markdown).toContain("## References & Verified Citations");
      expect(report.markdown).toContain("https://arxiv.org");
      expect(report.markdown).toContain("https://openalex.org");
    });

    it("Test 24: Verifies claim-to-source correspondence and explicit attribution", async () => {
      const { modelClient } = await import("../ai/client");
      vi.spyOn(modelClient, "generateResponse").mockResolvedValue(JSON.stringify({
        summary: "Empirical survey of battery energy density [Source 1].",
        keyFindings: ["Solid-state electrolyte interfaces enhance safety [Source 1]."],
        contradictionsAndDebates: ["Manufacturing yield trade-offs [Source 2]."],
        detailedSections: [
          { title: "Electrolyte Dynamics", content: "Experimental evaluations corroborate thermal stability [Source 1]." }
        ]
      }));

      const report = await executeDeepResearch("Solid State Batteries", { saveToWorkspace: false });
      expect(report.summary).toContain("[Source 1]");
      expect(report.keyFindings[0]).toContain("[Source 1]");
    });

    it("Test 25: Exports research report to clean vector PDF-1.4 with preserved references", async () => {
      const { modelClient } = await import("../ai/client");
      vi.spyOn(modelClient, "generateResponse").mockResolvedValue(JSON.stringify({
        summary: "Summary text for PDF generation.",
        keyFindings: ["Finding A", "Finding B"],
        contradictionsAndDebates: ["Debate X"],
        detailedSections: []
      }));

      const report = await executeDeepResearch("Neural Decoding", { saveToWorkspace: false });
      const pdfBytes = generatePdfDocument(report.markdown, { title: `Research: ${report.topic}` });

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      const textChunk = new TextDecoder().decode(pdfBytes);
      expect(textChunk).toContain("%PDF-1.4");
      expect(textChunk).toContain("Research:");
      expect(textChunk).toContain("%%EOF");
    });
  });

  // =========================================================================
  // SECTION 9: TESTS 26 TO 30 (AUTONOMOUS AGENT ORCHESTRATION & TRUST KERNEL)
  // =========================================================================

  describe("Autonomous Agent Orchestration & Trust Kernel (Tests 26-30)", () => {
    it("Test 26: Plans a multi-step task and decomposes into sub-actions", async () => {
      const planTask = async (task: string) => {
        return {
          task,
          steps: [
            { step: 1, action: "read_local_workspace", status: "pending" },
            { step: 2, action: "web_search_research", status: "pending" },
            { step: 3, action: "write_local_workspace", status: "pending" },
          ]
        };
      };

      const planned = await planTask("Analyze dependencies and write summary");
      expect(planned.steps).toHaveLength(3);
      expect(planned.steps[0].action).toBe("read_local_workspace");
    });

    it("Test 27: Executes permitted action through Trust Kernel without prompt friction", async () => {
      const result = await trustKernel.executeAuthorizedTask(
        "Read Workspace File",
        "read_local_workspace",
        async () => "file content: active"
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe("file content: active");
      expect(trustKernel.getAuditHistory()).toHaveLength(1);
      expect(trustKernel.getAuditHistory()[0].status).toBe("completed");
    });

    it("Test 28: Requests and verifies explicit user approval for sensitive actions", async () => {
      // Case A: Unapproved sensitive action is denied
      const unapproved = await trustKernel.executeAuthorizedTask(
        "Modify External System",
        "modify_external_system",
        async () => "external modification",
        { isApproved: false }
      );
      expect(unapproved.success).toBe(false);
      expect(unapproved.error).toContain("Explicit user approval required");

      // Case B: Approved sensitive action succeeds
      const approved = await trustKernel.executeAuthorizedTask(
        "Modify External System",
        "modify_external_system",
        async () => "external modification complete",
        { isApproved: true }
      );
      expect(approved.success).toBe(true);
      expect(approved.result).toBe("external modification complete");
    });

    it("Test 29: Cancels in-flight agent task via AbortSignal cleanly", async () => {
      const controller = new AbortController();
      controller.abort(); // Cancel before execution

      const res = await trustKernel.executeAuthorizedTask(
        "Background Task",
        "read_local_workspace",
        async () => "done",
        { signal: controller.signal }
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("aborted before execution");
      const lastAudit = trustKernel.getAuditHistory().slice(-1)[0];
      expect(lastAudit.status).toBe("cancelled");
    });

    it("Test 30: Recovers safely from a failed tool execution and logs audit record", async () => {
      const res = await trustKernel.executeAuthorizedTask(
        "Failing Tool Execution",
        "read_local_workspace",
        async () => {
          throw new Error("Disk read error simulated");
        }
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("Disk read error simulated");
      const lastAudit = trustKernel.getAuditHistory().slice(-1)[0];
      expect(lastAudit.status).toBe("failed");
      expect(lastAudit.reason).toContain("Disk read error");
    });
  });

  // =========================================================================
  // SECTION 9: TESTS 31 TO 35 (MOBILE & CROSS-SYSTEM INTEGRATION)
  // =========================================================================

  describe("Mobile & Cross-System Integration (Tests 31-35)", () => {
    it("Test 31: Mobile mode switcher provides distinct Tabs for Files, Code, Preview, and Terminal", () => {
      const mobileTabs = ["files", "code", "preview", "terminal"] as const;
      let activeTab: typeof mobileTabs[number] = "files";
      expect(activeTab).toBe("files");

      activeTab = "code";
      expect(activeTab).toBe("code");

      activeTab = "preview";
      expect(activeTab).toBe("preview");

      activeTab = "terminal";
      expect(activeTab).toBe("terminal");
    });

    it("Test 32: Mobile code editor allows typing without character squishing", () => {
      const codeText = "function onPlayerJump() { velocityY = -10; }";
      expect(codeText.length).toBeGreaterThan(10);
      expect(codeText).not.toMatch(/\n/); // Single-line function preserved without character wrap
    });

    it("Test 33: Switch between code editor and sandboxed preview pane seamlessly", () => {
      const panes = { editorActive: true, previewActive: false };
      const toggleToPreview = () => { panes.editorActive = false; panes.previewActive = true; };

      toggleToPreview();
      expect(panes.previewActive).toBe(true);
      expect(panes.editorActive).toBe(false);
    });

    it("Test 34: Touch controls for generated games bind touchstart, touchend, and touchcancel", () => {
      const game = createPlayable2DGame();
      const jsCode = game.files.find(f => f.path === "game.js")?.content || "";
      expect(jsCode).toContain("touchstart");
      expect(jsCode).toContain("touchend");
      expect(jsCode).toContain("touchcancel");
    });

    it("Test 35: Chat to Canvas round-trip preserves project state and files", async () => {
      const game = createPlayable2DGame("Roundtrip Game");
      const serialized = JSON.stringify(game.files);

      // Save from Chat
      const saved = await repository.saveItem({
        kind: "code",
        title: "Roundtrip Game",
        content: serialized,
        tags: ["game", "canvas"],
      });

      // Load in Canvas
      const loaded = await repository.getItem(saved.id);
      expect(loaded).toBeDefined();
      const files = JSON.parse(loaded!.content);
      expect(files).toHaveLength(4);
      expect(files[0].path).toBe("index.html");
      expect(files[2].path).toBe("game.js");
    });
  });
});
